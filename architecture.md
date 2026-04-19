# Overwatch Homelab — Architecture

## Overview

Overwatch Homelab is a multi-tenant homelab management platform built as a TypeScript monorepo. It consists of four runtime components: a PostgreSQL database, a REST + WebSocket API server, a React web client, and a lightweight agent that runs on each managed lab machine.

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
  (each managed machine)
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
- CRUD API for HomeLab and StoragePool resources, scoped to the authenticated user
- WebSocket server for real-time agent communication

Key libraries: `express`, `express-rate-limit`, `socket.io`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `zod`

**Rate limiting:**
- Auth endpoints: 20 requests per 15 minutes
- API endpoints: 120 requests per minute

**JWT:** HS256, default expiry 7 days. Secret must be set via `JWT_SECRET` env var in production; enforced at startup.

**BigInt handling:** Prisma returns `StoragePool.totalBytes` / `usedBytes` as `BigInt`. A global Express JSON replacer converts `BigInt → Number` before serialization.

---

### `hub-client`

**Runtime:** nginx (production), Vite dev server (local dev)  
**Port:** 80 in container, mapped to host 5174

A React 18 SPA built with Vite and served as static files via nginx. In production (Docker), nginx also acts as a reverse proxy, forwarding `/api/*` and `/socket.io/*` to `hub-server:3001` on the internal Docker network. This avoids exposing `hub-server` directly to the browser and resolves the Docker internal hostname issue.

Key libraries: `react`, `react-router-dom` v6, `@tanstack/react-query` v5, `tailwindcss`, `lucide-react`

**State management:**
- Server state: TanStack Query (queries + mutations, 30s stale time)
- Auth state: React Context (`AuthContext`) backed by `localStorage`. A single `AuthProvider` wraps the app so all components share one token/user state.
- UI state: local `useState`

**Routing:**
- `/` → redirects to `/overview`
- `/overview` → HomeLab list + create wizard
- `/labs/:labId` → HomeLab detail (storage pools, edit, delete)
- Unauthenticated users see `LoginPage`; all protected routes are gated by `isAuthenticated` in `App.tsx`

**API client:** `apiFetch` — a thin wrapper around `fetch` that injects the Bearer token, serializes the body, and handles both JSON and `204 No Content` responses.

---

### `lab-agent`

**Runtime:** Node.js 20  
**Transport:** Socket.IO client

A long-running process deployed on each physical or virtual lab machine. It connects to `hub-server` via Socket.IO with automatic reconnection and emits three event types:

| Event | Interval | Payload |
|---|---|---|
| `agent:register` | On connect | `labId`, `agentVersion` |
| `agent:heartbeat` | Every 15 s | `labId`, `timestamp` |
| `agent:metrics` | Every 60 s | `LabMetrics` — CPU, memory, disks, network, OS info, uptime |

Metrics are collected via the [`systeminformation`](https://www.npmjs.com/package/systeminformation) library (v5). All metric collection is asynchronous. The following `systeminformation` functions are called in parallel on each interval:

| si function | Metrics provided |
|---|---|
| `si.cpu()` | manufacturer, brand, cores, physicalCores, base clock speed |
| `si.currentLoad()` | real-time CPU usage percentage |
| `si.cpuTemperature()` | CPU temperature (null on unsupported platforms, e.g. macOS) |
| `si.mem()` | total, used, free, available, swap used/total |
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

HomeLab
  id          UUID  PK
  name        String
  description String?
  ownerId     UUID  FK → User (CASCADE DELETE)
  createdAt   DateTime
  updatedAt   DateTime
  storagePools StoragePool[]

StoragePool
  id          UUID  PK
  name        String
  totalBytes  BigInt
  usedBytes   BigInt
  homeLabId   UUID  FK → HomeLab (CASCADE DELETE)
  createdAt   DateTime
  updatedAt   DateTime
```

---

## Docker Compose

All four services run in a shared default bridge network. Compose builds local images from source using workspace-aware multi-stage Dockerfiles (build context is the repo root so `packages/` is available during the build).

| Service | Image | Host Port |
|---|---|---|
| postgres | postgres:16-alpine | 5432 |
| hub-server | overwatch/hub-server:local | 3002 |
| hub-client | overwatch/hub-client:local | 5174 |
| lab-agent | overwatch/lab-agent:local | — |

**Build notes:**
- All Dockerfiles use `node:20-slim` as the base. OpenSSL is installed in both builder and runner stages to satisfy Prisma's query engine requirements.
- `hub-client` Dockerfile accepts a `VITE_API_URL` build arg (defaults to empty string so the client uses relative URLs proxied by nginx).
- `hub-server` and `hub-client` images use multi-stage builds to keep the final runtime image lean.

---

## Data Flow

### Authentication

```
Browser → POST /api/auth/login
        ← { token, user }
Browser stores token in localStorage via AuthContext
All subsequent requests include Authorization: Bearer <token>
```

### HomeLab management

```
Browser → GET  /api/homelabs              list user's labs
Browser → POST /api/homelabs              create lab
Browser → GET  /api/homelabs/:id          get lab + pools
Browser → PATCH /api/homelabs/:id         update name/description
Browser → DELETE /api/homelabs/:id        delete lab (cascades pools)
Browser → POST /api/homelabs/:id/storage-pools   add pool
Browser → DELETE /api/homelabs/:id/storage-pools/:pid  remove pool
```

All routes are authenticated. Resources are always scoped to `req.user.userId`.

### Real-time agent telemetry

```
lab-agent  →  agent:register   →  hub-server (joins room lab:<labId>)
           →  agent:heartbeat  →  hub-server (updates lastHeartbeat)
           →  agent:metrics    →  hub-server
                                    → broadcasts lab:metrics to room lab:<labId>
                                    → (future) dashboard clients subscribe to room
```

---

## Local Development

**With Docker Compose (recommended):**
```bash
docker-compose up --build
# UI:    http://localhost:5174
# API:   http://localhost:3002
# DB:    localhost:5432
```

**Without Docker (native):**
```bash
cp apps/hub-server/.env.example apps/hub-server/.env  # set DATABASE_URL, JWT_SECRET
npm install
npm run build           # build shared-types first
cd apps/hub-server && npm run db:push
npm run dev             # starts all workspaces concurrently
```

---

## Security Considerations (current state)

- Passwords hashed with bcrypt (cost factor 12)
- JWT secret **must** be set via env var in production; startup throws if missing
- Rate limiting on auth (20/15 min) and API (120/min) endpoints
- All API resources owner-scoped; no cross-user data leakage
- `docker-compose.yaml` contains hardcoded dev credentials — **do not use in production**
- JWT secret in compose is a placeholder (`dev_jwt_secret`) — rotate before any deployment
