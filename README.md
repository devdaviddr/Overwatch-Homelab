# Overwatch Homelab

A multi-tenant resource monitoring platform that collects real system metrics from registered machines, persists them for historical analysis, and displays them live in a mission-control-style browser dashboard. Built as a TypeScript monorepo using npm workspaces.

**Current release:** v0.2.0 — historical metrics, time-range charts, threshold alerting, profile management, platform hardening · [Spec](spec/0.2.0/0.2.0.md) · [Architecture](spec/architecture.md)
**Previous:** [v0.1.0](spec/0.1.0/0.1.0.md) · [v0.1.1](spec/0.1.1/0.1.1.md) · [v0.1.2](spec/0.1.2/0.1.2.md)

## Monorepo Structure

```
overwatch-homelab/
├── apps/
│   ├── hub-server/          # Express API + Socket.IO (Prisma + JWT + Vitest)
│   ├── hub-client/          # React + Tailwind CSS dashboard (nginx)
│   └── lab-agent/           # Lightweight agent that runs on each monitored machine
├── packages/
│   └── shared-types/        # Shared Zod schemas & TypeScript interfaces
├── spec/
│   ├── architecture.md      # Living architecture document
│   ├── 0.1.0/  0.1.1/  0.1.2/
│   └── 0.2.0/               # current release spec
├── docker-compose.yaml      # Full local stack (postgres, hub-server, hub-client)
├── tsconfig.base.json
└── package.json             # npm workspaces root
```

## Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 9

---

## Running with Docker Compose (recommended)

v0.2.0 requires `JWT_SECRET` to be supplied via env — hub-server refuses to start without it.

```bash
# Generate a strong secret:
export JWT_SECRET=$(openssl rand -hex 32)

docker compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:5174 |
| API | http://localhost:3002 |
| Database | localhost:5432 |

Default login: `admin@example.com` / `AdminPass123!`

> **Note:** The `lab-agent` service in docker-compose is provided for Linux hosts only.
> On macOS, Docker runs inside a Linux VM — the agent will report VM specs, not your real hardware.
> See [Running the agent natively](#running-the-agent-natively) below.

---

## Running the Agent Natively

To monitor **real host hardware** (required on macOS, recommended everywhere), run the agent as a native Node.js process directly on the machine you want to monitor.

### 1. Create your Resource in the dashboard

Log in, click **New Resource**, complete the 3-step wizard (name, type, labels) and create it. You'll be taken to the Resource detail page.

### 2. Copy the LAB_ID

The Configuration tab shows the agent panel with your `LAB_ID` (UUID) and `HUB_URL` pre-filled. Copy the `.env` snippet.

### 3. Configure the agent

```bash
cp apps/lab-agent/.env.example apps/lab-agent/.env
# Edit and set LAB_ID and HUB_URL
```

```env
LAB_ID=<your-homelab-uuid>
HUB_URL=http://<hub-server-host>:3002
HEARTBEAT_INTERVAL_MS=15000
METRICS_INTERVAL_MS=60000
```

### 4. Build and run

```bash
npm install
npm run build --workspace=packages/shared-types
npm run build --workspace=apps/lab-agent
cd apps/lab-agent && node dist/index.js
```

Or for development (auto-reloads):

```bash
cd apps/lab-agent && npm run dev
```

v0.2.0 adds an exponential reconnect backoff (2 s → 30 s cap with jitter) and a structured startup banner so it's easier to see the agent's configuration at a glance.

---

## Local Development (without Docker)

```bash
# 1. Start just the database
docker compose up -d postgres

# 2. Copy and configure env files
cp apps/hub-server/.env.example apps/hub-server/.env   # set JWT_SECRET, DATABASE_URL, CORS_ORIGIN
cp apps/lab-agent/.env.example  apps/lab-agent/.env    # set LAB_ID, HUB_URL

# 3. Install dependencies
npm install

# 4. Push the DB schema (v0.2.0 adds MetricSnapshot + Alert tables)
cd apps/hub-server && npx prisma db push && cd ../..

# 5. Start hub-server and hub-client in separate terminals
cd apps/hub-server && npm run dev
cd apps/hub-client && npm run dev

# 6. Run the agent natively
cd apps/lab-agent && npm run dev
```

Dashboard: http://localhost:5173 | API: http://localhost:3001

---

## Testing

```bash
npm run test --workspace=apps/hub-server     # 38 Vitest unit/middleware tests (< 300 ms)
npm run typecheck                            # cascades across all workspaces; rebuilds shared-types first
```

Coverage in v0.2.0: cursor pagination, time-bucket downsampling, password policy, env validator, alert evaluator, retention pruner, socket auth middleware. Client + lab-agent tests are deferred to v0.3.0.

---

## Apps

### `apps/hub-server`

Express API with:

- **JWT authentication** (`POST /api/auth/register`, `POST /api/auth/login`, `PATCH /api/auth/profile`)
- **Resource CRUD** (`/api/homelabs`) — create, list (cursor-paginated), get, update, delete
- **Historical metrics** — `GET /api/homelabs/:id/metrics` with `from`/`to`/`resolution` query params and server-side time-bucket averaging
- **Alerts** — `GET /api/homelabs/:id/alerts`, `POST /api/homelabs/:id/alerts/:alertId/acknowledge`
- **Socket.IO** — JWT-authenticated dashboard handshake; ownership-checked `dashboard:subscribe`; `lab:alert` / `lab:alert-resolved` broadcasts; stale-agent pruner (60 s)
- **Background jobs** — retention pruner (6 h) deletes snapshots older than each lab's `retentionDays`
- **Startup env validation** — fails fast with a diagnostic list if `DATABASE_URL`, `JWT_SECRET`, or `CORS_ORIGIN` are missing or malformed

### `apps/hub-client`

React dashboard with:

- Login page + `/profile` page (name + password change)
- **Overview** — Resource cards with type badge and labels
- **Resource detail** with three tabs:
  - **Monitor** — summary cards (avg CPU 1h, peak mem 24h, worst disk %), time-range selector, historical line charts for CPU/memory/disk, live ring gauges + sparklines
  - **Alerts** — filterable alert log (active/resolved/all) with acknowledge action
  - **Configuration** — agent config panel + alert thresholds & retention settings
- **Global alert banner** — dismissable toast when a new alert fires on any owned resource
- **Sidebar badges** — red pip on any resource with active alerts
- TanStack Query for data fetching and cache management
- Socket.IO client presents a JWT on handshake
- Tailwind CSS, Lucide icons, `recharts`

### `apps/lab-agent`

Lightweight service that runs natively on each monitored machine:

- Connects to `hub-server` via Socket.IO with exponential reconnect backoff (2 s → 30 s cap, ~25 % jitter)
- Registers with a `LAB_ID` (UUID of an existing HomeLab)
- Sends **heartbeats** every 15 s (configurable per-lab)
- Collects and pushes **system metrics** every 60 s (configurable per-lab) using [`systeminformation`](https://www.npmjs.com/package/systeminformation):
  - CPU (model, cores, usage %, temperature)
  - Memory (RAM + swap: total, used, free, available)
  - Filesystems (per-mount: size, used, type)
  - Network interfaces (IP, MAC, operstate, speed)
  - OS info (platform, distro, hostname, arch)
  - Uptime
- Prints a structured startup banner with `HUB_URL`, `LAB_ID`, and interval settings

> **macOS / Docker note:** Docker on macOS runs inside a Linux VM. Running the agent inside Docker on macOS will report VM specs, not real host hardware. Run the agent natively for accurate metrics on macOS (and on Linux for full `/proc` access).

---

## Packages

### `packages/shared-types`

Shared Zod schemas and TypeScript types for:

- `User`, `HomeLab` (Resource) models, `ResourceType` enum
- `LabMetrics`, `MetricPoint`, `MetricsRangeResponse`
- `Alert`, `AlertMetric`, `AlertThresholds`
- `CreateUserSchema`, `PasswordPolicySchema`, `UpdateProfileSchema`
- `CursorPageSchema`, `PaginationQuerySchema`
- Agent ↔ Hub Socket.IO event payloads
- Generic API response wrappers

Exports both ESM and CJS via dual `exports` in `package.json`.

---

## Database Schema

```
User
  ├── id, email, name, password
  └── homelabs → HomeLab[]

HomeLab (Resource)
  ├── id, name, description, ownerId
  ├── resourceType (HOMELAB | SERVER | PC), labels (string[])
  ├── agentHubUrl, heartbeatIntervalMs, metricsIntervalMs
  ├── retentionDays (default 30)
  ├── alertThresholds? { cpuPercent, memPercent, diskPercent, consecutiveBreaches }
  ├── owner → User
  ├── snapshots → MetricSnapshot[]
  └── alerts → Alert[]

MetricSnapshot                        (v0.2.0)
  ├── id, labId, recordedAt
  ├── cpuPercent, memTotalBytes, memActiveBytes
  ├── diskSnapshots (JSON), rawPayload (JSON)
  └── @@index([labId, recordedAt DESC])

Alert                                 (v0.2.0)
  ├── id, labId, metric (cpu|memory|disk)
  ├── threshold, peakValue
  ├── firedAt, resolvedAt, acknowledgedAt
  └── @@index([labId, firedAt DESC])
```

Metrics are persisted and pruned per-lab every 6 h using the configured `retentionDays`.

---

## Roadmap

| Version | Theme | Status |
|---|---|---|
| v0.1.0 | Core platform: auth, resource management, live metrics, mission control UI | ✅ Released |
| v0.1.1 | macOS seamless agent launch + collapsible sidebar | ✅ Released |
| v0.1.2 | In-app Help Center with markdown rendering | ✅ Released |
| v0.2.0 | Historical metrics, time-range charts, threshold alerting, profile management, hardening | ✅ Released |
| v0.3.0+ | Email/webhook alert delivery, multi-user roles, resource sharing, TLS hardening, mobile layout | 🔮 Future |

---

## License

MIT
