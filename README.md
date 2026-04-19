# Overwatch Homelab

A multi-tenant homelab monitoring platform that collects real system metrics from registered machines and displays them live in a browser dashboard. Built as a TypeScript monorepo using npm workspaces.

## Monorepo Structure

```
overwatch-homelab/
├── apps/
│   ├── hub-server/          # Express API + Socket.IO (Prisma + JWT)
│   ├── hub-client/          # React + Tailwind CSS dashboard (nginx)
│   └── lab-agent/           # Lightweight agent that runs on each monitored machine
├── packages/
│   └── shared-types/        # Shared Zod schemas & TypeScript interfaces
├── docker-compose.yaml      # Full local stack (postgres, hub-server, hub-client)
├── tsconfig.base.json       # Shared TypeScript config
└── package.json             # npm workspaces root
```

## Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 9

---

## Running with Docker Compose (recommended)

Builds and starts the hub infrastructure (postgres, hub-server, hub-client):

```bash
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

### 1. Create your HomeLab in the dashboard

Log in, click **New HomeLab**, fill in the name and create it. You'll be taken to the HomeLab detail page.

### 2. Copy the LAB_ID

The HomeLab detail page shows the agent configuration panel with your `LAB_ID` (UUID) and `HUB_URL` pre-filled. Copy the `.env` snippet.

### 3. Configure the agent

```bash
# From the repo root:
cp apps/lab-agent/.env.example apps/lab-agent/.env
# Edit apps/lab-agent/.env and set LAB_ID and HUB_URL
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

---

## Local Development (without Docker)

```bash
# 1. Start just the database
docker compose up -d postgres

# 2. Copy and configure env files
cp apps/hub-server/.env.example apps/hub-server/.env  # set JWT_SECRET, DATABASE_URL
cp apps/lab-agent/.env.example  apps/lab-agent/.env   # set LAB_ID, HUB_URL

# 3. Install dependencies
npm install

# 4. Push the DB schema
cd apps/hub-server && npx prisma db push && cd ../..

# 5. Start hub-server and hub-client in separate terminals
cd apps/hub-server && npm run dev
cd apps/hub-client && npm run dev

# 6. Run the agent natively
cd apps/lab-agent && npm run dev
```

Dashboard: http://localhost:5173 | API: http://localhost:3001

---

## Apps

### `apps/hub-server`

Express API with:

- **JWT authentication** (`POST /api/auth/register`, `POST /api/auth/login`)
- **HomeLab CRUD** (`/api/homelabs`) — create, list, get, update (including agent config), delete
- **Socket.IO** server for real-time agent connections and live metrics broadcasting

### `apps/hub-client`

React dashboard with:

- Login page with JWT auth
- Overview page with HomeLab cards (click to open detail)
- HomeLab detail page: agent config panel, live metrics dashboard, edit/delete
- Create HomeLab wizard (name + description)
- TanStack Query for data fetching and cache management
- Socket.IO client for live metrics via `lab:metrics` events
- Tailwind CSS + Lucide icons

### `apps/lab-agent`

Lightweight service that runs natively on each monitored machine:

- Connects to `hub-server` via Socket.IO (automatic reconnection)
- Registers with a `LAB_ID` (must be the UUID of an existing HomeLab)
- Sends **heartbeats** every 15 s
- Collects and pushes **system metrics** every 60 s using [`systeminformation`](https://www.npmjs.com/package/systeminformation):
  - CPU (model, cores, usage %, temperature)
  - Memory (RAM + swap: total, used, free, available)
  - Filesystems (per-mount: size, used, type)
  - Network interfaces (IP, MAC, operstate, speed)
  - OS info (platform, distro, hostname, arch)
  - Uptime

> **macOS / Docker note:** Docker on macOS runs inside a Linux VM. Running the agent inside Docker on macOS will report VM specs, not real host hardware. Run the agent natively for accurate metrics on macOS (and on Linux for full `/proc` access).

---

## Packages

### `packages/shared-types`

Shared Zod schemas and TypeScript types for:

- `User`, `HomeLab` models
- `LabMetrics` (CPU, memory, disks, network, OS)
- Agent ↔ Hub Socket.IO event payloads
- Generic API response wrappers

Exports both ESM and CJS via dual `exports` in `package.json`.

---

## Database Schema

```
User
  ├── id, email, name, password
  └── homelabs → HomeLab[]

HomeLab
  ├── id, name, description, ownerId
  ├── agentHubUrl, heartbeatIntervalMs, metricsIntervalMs
  └── owner → User
```

---

## License

MIT
