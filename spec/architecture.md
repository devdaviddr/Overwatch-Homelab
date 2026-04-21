# Overwatch Homelab — Architecture

## Overview

Overwatch Homelab is a multi-tenant homelab monitoring platform built as a TypeScript monorepo. It consists of four runtime components: a PostgreSQL database, a REST + WebSocket API server, a React web client, and a lightweight agent that runs on each managed lab machine. The platform collects real-time system metrics from registered lab machines, persists them for historical analysis, evaluates threshold-based alerts, and displays everything in the browser dashboard.

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
                                      │  persists MetricSnapshot
                                      │  evaluates alerts
                                      ▼
                             Browser (dashboard)
                               (Socket.IO client with JWT)
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

npm workspaces are used. All apps reference `@overwatch/shared-types` via the workspace protocol (`"*"`). The root `package.json` defines scripts that cascade across all workspaces (`build`, `dev`, `lint`, `typecheck`). Root `typecheck` rebuilds `packages/shared-types` first so downstream apps always see fresh `.d.ts` output.

---

## Components

### `hub-server`

**Runtime:** Node.js 20, Express 4, Socket.IO 4
**Port:** 3001 (mapped to host 3002 in compose)
**Database:** PostgreSQL 16 via Prisma ORM
**Testing:** Vitest (unit + middleware coverage; ~40 tests, < 300 ms)

Responsibilities:
- Authentication (register, login, profile updates) using bcrypt + JWT
- CRUD API for HomeLab resources, scoped to the authenticated user
- Cursor-paginated list endpoint, historical metrics endpoint with server-side downsampling, alert CRUD
- WebSocket server for real-time agent communication and authenticated metrics broadcasting
- Async out-of-band handlers on every metrics push: **persist a `MetricSnapshot`** and **evaluate alerts**
- Scheduled background jobs: **retention pruner** (6 h interval) and **stale-agent pruner** (60 s interval)

Key libraries: `express`, `express-rate-limit`, `socket.io`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `zod`

**Environment validation (H9):** `src/lib/env.ts` zod-parses `process.env` at import. `DATABASE_URL`, `JWT_SECRET` (min 16 chars), and `CORS_ORIGIN` (URL) are required; `PORT` and `JWT_EXPIRES_IN` have defaults. The server exits non-zero with a diagnostic list when any required var is missing or malformed.

**Rate limiting:**
- Auth endpoints: 20 requests per 15 minutes
- API endpoints: 120 requests per minute

**JWT:** HS256, default expiry 7 days. Secret is read from `env.JWT_SECRET`. There is **no dev fallback** — the server refuses to boot without a valid secret.

---

### `hub-client`

**Runtime:** nginx (production), Vite dev server (local dev)
**Port:** 80 in container, mapped to host 5174

A React 18 SPA built with Vite and served as static files via nginx. In production (Docker), nginx also acts as a reverse proxy, forwarding `/api/*` and `/socket.io/*` to `hub-server:3001` on the internal Docker network.

Key libraries: `react`, `react-router-dom` v6, `@tanstack/react-query` v5, `socket.io-client`, `tailwindcss`, `lucide-react`, `recharts`

**State management:**
- Server state: TanStack Query (queries + mutations, auto-refresh on the history/alerts endpoints)
- Auth state: React Context (`AuthContext`) backed by `localStorage`. `login()` / `logout()` call `resetSocket()` so the Socket.IO handshake picks up the new token on next connect.
- Real-time state: `useLabMetrics` (live metrics per lab), `useAlertStream` (global listener for `lab:alert` / `lab:alert-resolved`)
- UI state: local `useState`

**Socket.IO client:** `lib/socket.ts` exports a singleton `Socket` with an `auth: (cb) => cb({ kind: "dashboard", token })` factory so the JWT is sent fresh on every (re)connect. Emits `dashboard:subscribe` with each lab UUID the user owns; the server validates ownership before joining the room.

**Routing:**
- `/overview` — Resource list with type badges, labels, "New Resource" wizard
- `/labs/:labId` — Resource detail with **Monitor**, **Alerts**, **Configuration** tabs
- `/profile` — Display name + password change form
- `/help/:topicId` — Markdown-rendered Help Center (getting-started, agent-setup, architecture, alerts, faq)

**Monitor tab:**
- **Summary cards** — avg CPU (1 h), peak memory (24 h), current worst disk %
- **Time-range selector** (1 h / 6 h / 24 h / 7 d) drives historical charts
- **Historical charts** — recharts `LineChart` for CPU %, memory %, and per-mount disk %. Server returns pre-averaged points; refresh cadence matches the window (30 s for 1h/6h; 5 min for 24h/7d).
- **Live mission-control panel** — SVG ring gauges, sparkline history, disk/network cards (unchanged from v0.1.x)

**Alerts tab:** list filter (active/resolved/all), acknowledge action, status pills, and firedAt/resolvedAt timestamps. Polled every 30 s; invalidated immediately when a new `lab:alert` fires.

**Configuration tab:** AgentConfigPanel (hub URL, intervals, Start/Stop for the local agent) and `AlertSettingsPanel` (threshold toggle, CPU/memory/disk %, consecutive breaches, retentionDays).

**Global alert banner:** `AlertBanner` mounts at the dashboard layout level and subscribes to every owned lab's socket room. When `lab:alert` fires it shows a dismissable toast for 10 s and invalidates the sidebar's active-alert queries.

**API client:** `apiFetch` — a thin wrapper around `fetch` that injects the Bearer token, serializes the body, and handles both JSON and `204 No Content` responses.

---

### `lab-agent`

**Runtime:** Node.js 20 (native process on monitored machine)
**Transport:** Socket.IO client

A long-running process deployed **natively** on each physical or virtual lab machine. Connects to `hub-server` with:

- `auth: { kind: "agent" }` on handshake (no token — `labId` remains the capability)
- **Exponential reconnect backoff** (2 s → 30 s cap) with ~25 % jitter via socket.io-client's `reconnectionDelay` / `reconnectionDelayMax` / `randomizationFactor`
- **Structured startup banner** printing `HUB_URL`, `LAB_ID`, `HEARTBEAT_INTERVAL_MS`, `METRICS_INTERVAL_MS`

Emits three event types:

| Event | When | Payload |
|---|---|---|
| `agent:register` | On connect | `labId`, `agentVersion` |
| `agent:heartbeat` | Every 15 s (configurable) | `labId`, `timestamp` |
| `agent:metrics` | Immediately after register ACK, then every 60 s (configurable) | `LabMetrics` |

**macOS / Docker note:** Docker on macOS runs inside a Linux VM. Running the agent inside Docker on macOS causes `systeminformation` to report the VM's virtualised hardware — not the real host. Run the agent natively on macOS. On Linux hosts, Docker with `--pid=host --privileged` exposes real host metrics.

Metrics are collected via the [`systeminformation`](https://www.npmjs.com/package/systeminformation) library (v5).

| si function | Metrics provided |
|---|---|
| `si.cpu()` | manufacturer, brand, cores, physicalCores, base clock speed |
| `si.currentLoad()` | real-time CPU usage percentage |
| `si.cpuTemperature()` | CPU temperature (null on unsupported platforms) |
| `si.mem()` | total, used, free, available, active, swap used/total |
| `si.fsSize()` | per-filesystem size, used, available, mount point, type |
| `si.networkInterfaces()` | external interfaces: IP, MAC, operstate, link speed |
| `si.osInfo()` | platform, distro, release, arch, hostname |
| `si.time()` | system uptime |

Configuration is entirely via environment variables: `HUB_URL`, `LAB_ID`, `HEARTBEAT_INTERVAL_MS`, `METRICS_INTERVAL_MS`.

---

### `shared-types`

A pure TypeScript package depending only on `zod`. Exports Zod schemas and inferred types for all domain models, API contracts, Socket.IO event payloads, and metrics shapes. Used by `hub-server`, `hub-client`, and `lab-agent` for end-to-end type safety.

v0.2.0 additions: `AlertSchema`, `AlertThresholdsSchema`, `MetricPointSchema`, `MetricsRangeResponseSchema`, `MetricsRangeQuerySchema`, `UpdateProfileSchema`, `PasswordPolicySchema`, `ResetPasswordSchema`, `CursorPageSchema`, `PaginationQuerySchema`.

Exports ESM (`import`) and CJS (`require`) via dual `exports` in `package.json`.

---

### PostgreSQL

Image: `postgres:16-alpine`
Database: `overwatch_db`
Schema managed by Prisma (`prisma db push` for dev, generate for production).

**Models:**

```
User
  id                 UUID  PK
  email              String  UNIQUE
  name               String
  password           String   (bcrypt hash)
  recoveryTokenHash  String?  (bcrypt hash of 64-char hex recovery token; null before first signup/reset)
  createdAt          DateTime
  updatedAt          DateTime
  homelabs           HomeLab[]

HomeLab  (referred to as "Resource" in the UI)
  id                   UUID  PK
  name                 String
  description          String?
  resourceType         ResourceType  default HOMELAB
  labels               String[]      default []
  ownerId              UUID  FK → User (CASCADE DELETE)
  agentHubUrl          String?
  heartbeatIntervalMs  Int        default 15000
  metricsIntervalMs    Int        default 60000
  retentionDays        Int        default 30
  alertThresholds      Json?      { cpuPercent, memPercent, diskPercent, consecutiveBreaches } | null
  createdAt            DateTime
  updatedAt            DateTime
  snapshots            MetricSnapshot[]
  alerts               Alert[]
  @@index([ownerId, createdAt])                 ← backs cursor pagination

MetricSnapshot    (v0.2.0)
  id              UUID  PK
  labId           UUID  FK → HomeLab (CASCADE DELETE)
  recordedAt      DateTime
  cpuPercent      Float
  memTotalBytes   BigInt
  memActiveBytes  BigInt
  diskSnapshots   Json   [{ mountPoint, usedBytes, totalBytes }]
  rawPayload      Json   full LabMetrics blob
  @@index([labId, recordedAt DESC])

Alert    (v0.2.0)
  id              UUID  PK
  labId           UUID  FK → HomeLab (CASCADE DELETE)
  metric          AlertMetric   (cpu | memory | disk)
  threshold       Float
  peakValue       Float
  firedAt         DateTime
  resolvedAt      DateTime?
  acknowledgedAt  DateTime?
  @@index([labId, firedAt DESC])

enum ResourceType { HOMELAB | SERVER | PC }
enum AlertMetric  { cpu | memory | disk }
```

v0.2.0 makes metrics persistent. The live Socket.IO broadcast path is unchanged for latency — historical storage runs **out-of-band** from a metrics listener registered via `onAgentMetrics()`.

---

## Docker Compose

Three infrastructure services run in a shared default bridge network. Images are built from source using workspace-aware multi-stage Dockerfiles (build context is the repo root so `packages/` is available during the build).

| Service | Image | Host Port | Profile | Notes |
|---|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | default | |
| hub-server | overwatch/hub-server:local | 3002 | default | `JWT_SECRET` required via `${repo}/.env` or shell env |
| hub-client | overwatch/hub-client:local | 5174 | default | nginx reverse proxy |
| lab-agent | overwatch/lab-agent:local | — | `agent` | opt-in — `docker compose --profile agent up -d`. Linux hosts only; macOS should run the agent natively |

**Env file loading:** `docker-compose` auto-loads `${repo_root}/.env`. That file is gitignored (`.gitignore:17`); a template lives in `.env.example` with placeholders for `JWT_SECRET` (generate via `openssl rand -hex 32`) and optional `LAB_ID`. The compose interpolation uses `${JWT_SECRET:-}` and `${LAB_ID:-}` (soft defaults) so non-destructive commands (`down`, `logs`, `ps`, `config`) work without requiring the env vars to be set — the hub-server's own startup validator is the authoritative check.

**Build notes:**
- All Dockerfiles use `node:20-slim` as the base. OpenSSL is installed in both builder and runner stages to satisfy Prisma's query engine requirements.
- `hub-client` Dockerfile accepts a `VITE_API_URL` build arg (defaults to empty string so the client uses relative URLs proxied by nginx).
- `hub-server` and `hub-client` images use multi-stage builds to keep the final runtime image lean.
- The `lab-agent` Docker service is provided for Linux deployments where `--pid=host --privileged` gives real host access. On macOS, run the agent natively.

---

## Data Flow

### Authentication

```
Browser → POST /api/auth/register
          { email, name, password }
        ← { token, user, recoveryToken }          ← shown once in UI
Browser → POST /api/auth/login
          { email, password }
        ← { token, user }
Browser → POST /api/auth/reset-password           ← public, no JWT
          { email, recoveryToken, newPassword }
        ← { token, user, recoveryToken }          ← new rotated token
Browser → POST /api/auth/recovery-token           ← authed — rotate from profile
        ← { recoveryToken }
Browser → PATCH /api/auth/profile                 ← authed
          { name?, currentPassword?, newPassword? }
        ← { id, email, name }

Browser stores token in localStorage via AuthContext. login() / logout()
call resetSocket() so the Socket.IO handshake picks up the new JWT on
next connect.
All subsequent REST requests include Authorization: Bearer <token>
Socket.IO handshake sends { kind: "dashboard", token: <jwt> }
```

`recoveryToken` is a 64-char hex string (32 bytes of entropy) generated with `crypto.randomBytes`. Bcrypt-hashed (cost 12) in `User.recoveryTokenHash`; plaintext is returned to the user **once** per signup / reset / regenerate and never stored. `POST /auth/reset-password` rotates the token on success, so each token is single-use. Unknown-user paths run a dummy bcrypt to keep response timing similar.

### Resource management (cursor-paginated)

```
Browser → GET    /api/homelabs?limit=50&cursor=…   cursor-paginated list
Browser → POST   /api/homelabs                     create resource
Browser → GET    /api/homelabs/:id                 resource detail
Browser → PATCH  /api/homelabs/:id                 update name/description/type/labels/agent/retention/alerts
Browser → DELETE /api/homelabs/:id
```

All routes are authenticated. Resources are always scoped to `req.user.userId`.

### Historical metrics (v0.2.0)

```
Browser → GET /api/homelabs/:id/metrics
          ?from=…&to=…&resolution=1m|5m|1h|raw
        ← { labId, from, to, resolution,
            points: [{ timestamp, cpuPercent, memActivePercent, diskUsedPercent }] }
```

The server queries `MetricSnapshot` rows in the window, then runs `bucketize()` in `src/lib/downsample.ts` to time-average each bucket. `raw` returns points unchanged.

### Alerts (v0.2.0)

```
Browser → GET  /api/homelabs/:id/alerts?status=active|resolved|all
        ← cursor-paginated { items: Alert[], nextCursor, hasMore }

Browser → POST /api/homelabs/:id/alerts/:alertId/acknowledge
        ← 204 No Content
```

### Profile (v0.2.0)

```
Browser → PATCH /api/auth/profile
          { name?, currentPassword?, newPassword? }
        ← { id, email, name }
```

Password policy (H6, enforced in `PasswordPolicySchema`): min 12 characters, at least one letter and one digit.

### Real-time agent telemetry

```
lab-agent  →  agent:register        →  hub-server
                                          joins room lab:<labId>
                                          ← hub:ack

lab-agent  →  agent:metrics (immediate) →  hub-server   ← sent right after ACK
lab-agent  →  agent:heartbeat       →  hub-server (every HEARTBEAT_INTERVAL_MS)
lab-agent  →  agent:metrics         →  hub-server (every METRICS_INTERVAL_MS)
                                          ┌──────────────────────────────┐
                                          │ onAgentMetrics listeners run │
                                          │ async, do NOT block the      │
                                          │ broadcast path:              │
                                          │  - persistMetricSnapshot()   │
                                          │  - evaluateAlerts()          │
                                          └──────────────────────────────┘
                                          broadcasts lab:metrics → room lab:<labId>
                                                                    ↓
                                                              browser dashboard

Browser    →  dashboard:subscribe   →  hub-server
                                          1. io.use() JWT middleware attaches userId
                                          2. HomeLab.ownerId === userId check
                                          3. joins room lab:<labId>

Alert fired  ──  hub-server emits  →  lab:alert          → room lab:<labId>
                                   →  lab:alert-resolved → room lab:<labId>
```

### Background jobs

| Job | Interval | Responsibility |
|---|---|---|
| Stale-agent pruner (H7) | 60 s | Evicts entries from `connectedAgents` whose last heartbeat exceeds `2.5 × heartbeatIntervalMs`; emits `lab:agent-status { connected: false }` to affected rooms |
| Retention pruner | 6 h | Batch-deletes (1000/iteration) `MetricSnapshot` rows older than each lab's `retentionDays` |

Both use `setInterval(...).unref()` so the hub-server process can exit cleanly for tests.

---

## Testing

Vitest runs in `apps/hub-server` with 47 tests across 9 files in ~1.1 s:

- **Pagination** — cursor encode/decode round-trip + malformed input
- **Downsampling** — raw pass-through, 5m bucket averaging, per-mount disk averaging, boundary alignment
- **Password policy** — CreateUserSchema + PasswordPolicySchema + UpdateProfileSchema edge cases
- **Env validator** — fail-fast on missing/short JWT_SECRET, missing DATABASE_URL (with mocked `process.exit`)
- **Alert evaluator** — no-thresholds short-circuit, fire on N breaches, no-fire when samples < N, peakValue updates, resolve on first non-breach
- **Retention pruner** — per-lab cutoff, 1000-row batching, partial-batch termination
- **Socket auth middleware** — agents pass without token; dashboard missing / invalid / expired / valid token paths
- **Recovery tokens** — 64-char hex generation + uniqueness, hash round-trip, wrong-token rejection
- **Reset schema** — `ResetPasswordSchema` hex/length/policy edge cases

Client and lab-agent have no automated tests in v0.2.0 — deferred to v0.3.0 per spec.

---

## Local Development

**With Docker Compose (hub stack only):**
```bash
# First time only — create the root .env file:
cp .env.example .env
# Edit .env and set JWT_SECRET to `openssl rand -hex 32`.

docker compose up --build
# Dashboard: http://localhost:5174
# API:       http://localhost:3002
# DB:        localhost:5432
```

The default profile starts only postgres + hub-server + hub-client. The lab-agent is opt-in behind the `agent` compose profile (Linux hosts only) — see below.

**Native agent (required on macOS, recommended elsewhere):**
```bash
# After creating a HomeLab in the dashboard and copying its UUID:
LAB_ID=<uuid> HUB_URL=http://localhost:3002 \
  HEARTBEAT_INTERVAL_MS=15000 METRICS_INTERVAL_MS=60000 \
  npx tsx apps/lab-agent/src/index.ts
```

The Configuration tab's .ENV FILE box pre-fills this command with the lab's UUID — copy/paste directly.

**Docker agent (Linux only):**
```bash
# Put LAB_ID=<uuid> in .env alongside JWT_SECRET, then:
docker compose --profile agent up -d
```

**Full native stack (no Docker):**
```bash
docker compose up -d postgres
cp apps/hub-server/.env.example apps/hub-server/.env  # set DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm install && npm run build
cd apps/hub-server && npx prisma db push && npm run dev
# (separate terminal) cd apps/hub-client && npm run dev
# (separate terminal) cd apps/lab-agent && npm run dev
```

---

## Security Considerations (current state)

- Passwords hashed with bcrypt (cost factor 12); policy enforced in Zod schema (min 12 + letter + digit) on register, profile password change, and reset-password.
- **Recovery tokens** are 32 random bytes (64-char hex), bcrypt-hashed at cost 12, shown once, rotated on every reset and on manual regenerate. Plaintext never stored.
- `POST /auth/reset-password` is intentionally public (no JWT) but runs a dummy bcrypt on missing-user paths to reduce timing side-channels.
- JWT secret **required** at startup — no dev fallback, no default in docker-compose. The hub-server exits with a clear diagnostic if `JWT_SECRET` is missing or < 16 chars.
- Rate limiting on auth (20/15 min) and API (120/min) endpoints — applies equally to login, register, reset-password, and recovery-token regenerate.
- All REST API resources owner-scoped; no cross-user data leakage (verified by manual QA).
- Socket.IO dashboard sockets authenticated with JWT on handshake; `dashboard:subscribe` checks `HomeLab.ownerId === socket.userId`. Unknown/foreign labs are rejected with `hub:error FORBIDDEN`.
- `agent:register` now also validates that the labId exists; unknown labs are rejected with `hub:error UNKNOWN_LAB` and the socket is disconnected (prevents log spam from stale-config agents and avoids FK-violation traffic).
- Agent-to-hub socket remains `labId`-only authenticated. Agent token auth ships in v0.3.0 as an opt-in per-lab mode (legacy `labId`-only remains the default) — see the Help Center "Profile & Security" entry for the trade-off.
- `docker-compose.yaml` contains hardcoded dev credentials for Postgres — **do not use in production**. `JWT_SECRET` and `LAB_ID` use soft defaults (`${VAR:-}`) so lifecycle commands (`down`/`logs`/`ps`) never block on missing env; the hub-server's own env validator is the authoritative check at startup.
