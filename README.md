# Overwatch Homelab

A AI-built, multi-tenant homelab management platform scaffolded as a TypeScript monorepo using npm workspaces.

## Monorepo Structure

```
overwatch-homelab/
├── apps/
│   ├── hub-server/          # Node.js Express API (Prisma + Socket.io + JWT)
│   ├── hub-client/          # React + Tailwind CSS dashboard
│   └── lab-agent/           # Lightweight agent that runs on remote servers
├── packages/
│   └── shared-types/        # Shared Zod schemas & TypeScript interfaces
├── docker-compose.yaml      # PostgreSQL database for development
├── tsconfig.base.json       # Shared TypeScript config
└── package.json             # npm workspaces root
```

## Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 9

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Configure environment variables

```bash
cp apps/hub-server/.env.example apps/hub-server/.env
cp apps/lab-agent/.env.example  apps/lab-agent/.env
```

Edit `apps/hub-server/.env` with your `JWT_SECRET`.  
Edit `apps/lab-agent/.env` and set `LAB_ID` to the UUID of your HomeLab (obtained after creating one via the API).

### 4. Run Prisma migrations

```bash
cd apps/hub-server
npm run db:generate
npm run db:migrate
```

### 5. Start services

In separate terminals:

```bash
# Hub API + Socket.io server
cd apps/hub-server && npm run dev

# React dashboard
cd apps/hub-client && npm run dev

# Lab agent (on a remote/local server)
cd apps/lab-agent && npm run dev
```

The dashboard will be available at **http://localhost:5173**.  
The API will be available at **http://localhost:3001**.

## Apps

### `apps/hub-server`

Express API with:

- **JWT authentication** (`POST /api/auth/register`, `POST /api/auth/login`)
- **HomeLab CRUD** (`/api/homelabs`)
- **StoragePool CRUD** (`/api/homelabs/:id/storage-pools`)
- **Socket.io** for real-time agent connections
- **Prisma ORM** with PostgreSQL

### `apps/hub-client`

React dashboard with:

- Login page with JWT auth
- Sidebar listing all configured Homelabs
- Overview page with homelab cards
- Per-homelab page showing storage pools with usage bars
- TanStack Query for data fetching
- Tailwind CSS + Lucide icons

### `apps/lab-agent`

Lightweight service that:

- Connects to `hub-server` via Socket.io
- Registers itself with a `labId`
- Sends periodic **heartbeats** (default: every 15 s)
- Reports system **metrics** (CPU, memory, disks) (default: every 60 s)

## Packages

### `packages/shared-types`

Shared Zod schemas and TypeScript types for:

- `User`, `HomeLab`, `StoragePool` models
- `LabMetrics` (CPU, memory, disk)
- Agent ↔ Hub Socket.io event payloads
- Generic API response wrappers

## Database Schema

```
User
  ├── id, email, name, password
  └── homelabs → HomeLab[]

HomeLab
  ├── id, name, description, ownerId
  └── storagePools → StoragePool[]

StoragePool
  └── id, name, totalBytes, usedBytes, homeLabId
```

## Docker

Start just the database:

```bash
docker compose up -d postgres
```

## License

MIT
