# Overwatch Homelab — Architecture

## Overview

Overwatch Homelab is a multi-tenant homelab monitoring platform built as a TypeScript monorepo. It consists of four runtime components: a PostgreSQL database, a REST + WebSocket API server, a React web client, and a lightweight agent that runs on each managed lab machine. The platform collects real-time system metrics from registered lab machines and displays them live in the browser dashboard.

```
Browser
  │  HTTP (port 5174)
  ▼
hub-client  (nginx)
  │  reverse-proxy /api/* and /socket.io/*
  ▼
hub-server  (Express + Socket.IO, port 3001)
  │  Prisma ORM
  ▼
postgres  (port 5432)

lab-agent  ──── Socket.IO ────▶  hub-server
  (native process on                  │
   each monitored machine)            │  broadcasts lab:metrics
                                      ▼
                             Browser (dashboard)
                               (Socket.IO client)
```

---

## Monorepo Structure

```
overwatch-homelab/
├── apps/
│   ├── hub-server/       Express API + Socket.IO server
│   ├── hub-client/       React SPA (Vite)
│   └── lab-agent/        Node.js agent that runs on lab machines
├── packages/
│   └── shared-types/     Zod schemas + TypeScript types shared across apps
├── docker-compose.yaml
├── package.json          npm workspaces root
└── tsconfig.base.json
```

npm workspaces are used. All apps reference `@overwatch/shared-types` via the workspace protocol (`"*"`). The root `package.json` defines scripts that cascade across all workspaces (`build`, `dev`, `lint`, `typecheck`).

---

## Components

### `hub-server`

**Runtime:** Node.js 20, Express 4, Socket.IO 4  
**Port:** 3001 (mapped to host 3002 in compose)  
**Database:** PostgreSQL 16 via Prisma ORM

Responsibilities:
- Authentication (register, login) using bcrypt + JWT
- CRUD API for HomeLab resources, scoped to the authenticated user
- WebSocket server for real-time agent communication and metrics broadcasting

Key libraries: `express`, `express-rate-limit`, `socket.io`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `zod`

**Rate limiting:**
- Auth endpoints: 20 requests per 15 minutes
- API endpoints: 120 requests per minute

**JWT:** HS256, default expiry 7 days. Secret must be set via `JWT_SECRET` env var in production; enforced at startup.

---

### `hub-client`

**Runtime:** nginx (production), Vite dev server (local dev)  
**Port:** 80 in container, mapped to host 5174

A React 18 SPA built with Vite and served as static files via nginx. In production (Docker), nginx also acts as a reverse proxy, forwarding `/api/*` and `/socket.io/*` to `hub-server:3001` on the internal Docker network. This avoids exposing `hub-server` directly to the browser and resolves the Docker internal hostname issue.

Key libraries: `react`, `react-router-dom` v6, `@tanstack/react-query` v5, `socket.io-client`, `tailwindcss`, `lucide-react`, `recharts`

**State management:**
- Server state: TanStack Query (queries + mutations, 30s stale time)
- Auth state: React Context (`AuthContext`) backed by `localStorage`. A single `AuthProvider` wraps the app so all components share one token/user state.
- Real-time state: `useLabMetrics` hook — subscribes to `lab:metrics` Socket.IO events and holds the latest `LabMetrics` snapshot per lab
- UI state: local `useState`

**Socket.IO client:** `lib/socket.ts` exports a singleton `Socket` instance that connects via the nginx-proxied `/socket.io` path (relative URL). It is shared across all components so a single persistent connection serves the whole app. When `HomeLabPage` mounts, it emits `dashboard:subscribe` with the lab's UUID, causing hub-server to add that socket to the `lab:<labId>` broadcast room.

**Routing:**
- `/` → redirects to `/overview`
- `/overview` → Resource list with type badges, labels, and "New Resource" create wizard
- `/labs/:labId` → Resource detail: **Monitor** tab (mission control dashboard) and **Configuration** tab (agent config, edit/delete)
- Unauthenticated users see `LoginPage`; all protected routes are gated by `isAuthenticated` in `App.tsx`

**Dashboard UI (mission control):**
- SVG circular ring gauges for CPU and memory — color-coded cyan → amber (>70%) → red (>90%) with glow
- `recharts` AreaChart sparklines showing 30-point rolling history for CPU and memory
- Monospace status bar showing live status dot, hostname, OS, arch, and uptime
- Disk and network sections as card grids
- `useLabMetrics` hook accumulates up to 30 readings in a history buffer; memory % uses `activeBytes / totalBytes` (macOS accurate)

**API client:** `apiFetch` — a thin wrapper around `fetch` that injects the Bearer token, serializes the body, and handles both JSON and `204 No Content` responses.

---

### `lab-agent`

**Runtime:** Node.js 20 (native process on monitored machine)  
**Transport:** Socket.IO client

A long-running process deployed **natively** on each physical or virtual lab machine. It connects to `hub-server` via Socket.IO with automatic reconnection and emits three event types:

| Event | When | Payload |
|---|---|---|
| `agent:register` | On connect | `labId`, `agentVersion` |
| `agent:heartbeat` | Every 15 s | `labId`, `timestamp` |
| `agent:metrics` | Immediately after register ACK, then every 60 s | `LabMetrics` |

An initial metrics push is sent immediately upon receiving the hub's registration ACK, so the dashboard populates as soon as the agent connects rather than waiting for the first interval.

**macOS / Docker note:** Docker on macOS runs inside a Linux VM (Apple Virtualization Framework). Running the agent inside Docker on macOS causes `systeminformation` to report the VM's virtualised CPU, RAM, and filesystem — not the real host hardware. For accurate metrics on macOS, the agent must run as a native Node.js process. On Linux hosts, Docker with `--pid=host` and `--privileged` flags does expose real host metrics.

Metrics are collected via the [`systeminformation`](https://www.npmjs.com/package/systeminformation) library (v5). All metric collection is asynchronous. The following `systeminformation` functions are called in parallel on each interval:

| si function | Metrics provided |
|---|---|
| `si.cpu()` | manufacturer, brand, cores, physicalCores, base clock speed |
| `si.currentLoad()` | real-time CPU usage percentage |
| `si.cpuTemperature()` | CPU temperature (null on unsupported platforms, e.g. macOS) |
| `si.mem()` | total, used, free, available, active (macOS accurate), swap used/total |
| `si.fsSize()` | per-filesystem size, used, available, mount point, type |
| `si.networkInterfaces()` | external interfaces: IP, MAC, operstate, link speed |
| `si.osInfo()` | platform, distro, release, arch, hostname |
| `si.time()` | system uptime |

Configuration is entirely via environment variables: `HUB_URL`, `LAB_ID`, `HEARTBEAT_INTERVAL_MS`, `METRICS_INTERVAL_MS`.

---

### `shared-types`

A pure TypeScript package with no runtime dependencies other than `zod`. Exports Zod schemas and inferred types for all domain models, API contracts, Socket.IO event payloads, and metrics shapes. Used by both `hub-server` and `hub-client` to ensure end-to-end type safety.

Exports ESM (`import`) and CJS (`require`) via dual `exports` in `package.json`.

---

### PostgreSQL

Image: `postgres:16-alpine`  
Database: `overwatch_db`  
Schema managed by Prisma Migrate / `prisma db push`.

**Models:**

```
User
  id          UUID  PK
  email       String  UNIQUE
  name        String
  password    String  (bcrypt hash)
  createdAt   DateTime
  updatedAt   DateTime
  homelabs    HomeLab[]

HomeLab  (referred to as "Resource" in the UI)
  id                   UUID  PK
  name                 String
  description          String?
  resourceType         ResourceType  default HOMELAB
  labels               String[]      default []
  ownerId              UUID  FK → User (CASCADE DELETE)
  agentHubUrl          String?    (custom hub URL for the agent; null = use default)
  heartbeatIntervalMs  Int        default 15000
  metricsIntervalMs    Int        default 60000
  createdAt            DateTime
  updatedAt            DateTime

enum ResourceType { HOMELAB | SERVER | PC }
```

Disk, memory, and network metrics are **not persisted**. They are broadcast in real-time via Socket.IO and held only in browser memory until the next agent push or page refresh.

---

## Docker Compose

Three infrastructure services run in a shared default bridge network. Images are built from source using workspace-aware multi-stage Dockerfiles (build context is the repo root so `packages/` is available during the build).

| Service | Image | Host Port | Notes |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | |
| hub-server | overwatch/hub-server:local | 3002 | |
| hub-client | overwatch/hub-client:local | 5174 | nginx reverse proxy |
| lab-agent | overwatch/lab-agent:local | — | Linux hosts only |

**Build notes:**
- All Dockerfiles use `node:20-slim` as the base. OpenSSL is installed in both builder and runner stages to satisfy Prisma's query engine requirements.
- `hub-client` Dockerfile accepts a `VITE_API_URL` build arg (defaults to empty string so the client uses relative URLs proxied by nginx).
- `hub-server` and `hub-client` images use multi-stage builds to keep the final runtime image lean.
- The `lab-agent` Docker service is provided for Linux deployments where `--pid=host --privileged` gives real host access. On macOS, run the agent natively.

---

## Data Flow

### Authentication

```
Browser → POST /api/auth/login
        ← { token, user }
Browser stores token in localStorage via AuthContext
All subsequent requests include Authorization: Bearer <token>
```

### Resource management

```
Browser → GET    /api/homelabs          list user's resources
Browser → POST   /api/homelabs          create resource (name, description, resourceType, labels)
Browser → GET    /api/homelabs/:id      get resource detail
Browser → PATCH  /api/homelabs/:id      update name / description / resourceType / labels / agent config
Browser → DELETE /api/homelabs/:id      delete resource
```

All routes are authenticated. Resources are always scoped to `req.user.userId`.

### Real-time agent telemetry

```
lab-agent  →  agent:register        →  hub-server
                                          joins room lab:<labId>
                                          ← hub:ack

lab-agent  →  agent:metrics (immediate) →  hub-server   ← sent right after ACK
lab-agent  →  agent:heartbeat       →  hub-server (every 15 s)
lab-agent  →  agent:metrics         →  hub-server (every 60 s)
                                          broadcasts lab:metrics
                                          → room lab:<labId>
                                               ↓
                                          browser dashboard

Browser    →  dashboard:subscribe   →  hub-server
                                          joins room lab:<labId>
                                          (browser now receives lab:metrics)
```

The browser dashboard connects via the `socket.io-client` singleton in `lib/socket.ts`. When `HomeLabPage` mounts it emits `dashboard:subscribe`, the hub adds the socket to `lab:<labId>`, and the client receives all subsequent `lab:metrics` broadcasts from the agent in that room.

---

## Local Development

**With Docker Compose (hub infrastructure + Linux agent):**
```bash
docker compose up --build
# Dashboard: http://localhost:5174
# API:       http://localhost:3002
# DB:        localhost:5432
```

**Native agent (required on macOS):**
```bash
# After creating a HomeLab in the dashboard and copying the LAB_ID:
cd apps/lab-agent
# edit .env: set LAB_ID and HUB_URL=http://localhost:3002
npm run build && node dist/index.js
```

**Full native stack (no Docker):**
```bash
docker compose up -d postgres          # only postgres in docker
cp apps/hub-server/.env.example apps/hub-server/.env  # set DATABASE_URL, JWT_SECRET
npm install && npm run build
cd apps/hub-server && npx prisma db push && npm run dev
# (separate terminal) cd apps/hub-client && npm run dev
# (separate terminal) cd apps/lab-agent && npm run dev
```

---

## Security Considerations (current state)

- Passwords hashed with bcrypt (cost factor 12)
- JWT secret **must** be set via env var in production; startup throws if missing
- Rate limiting on auth (20/15 min) and API (120/min) endpoints
- All API resources owner-scoped; no cross-user data leakage
- `docker-compose.yaml` contains hardcoded dev credentials — **do not use in production**
- JWT secret in compose is a placeholder (`dev_jwt_secret`) — rotate before any deployment
