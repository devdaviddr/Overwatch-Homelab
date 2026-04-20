# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Overwatch Homelab is a multi-tenant homelab resource monitoring platform. A lightweight agent (`lab-agent`) runs on each monitored machine and streams real-time system metrics via Socket.IO to a central hub (`hub-server`), which broadcasts them to a React dashboard (`hub-client`). TypeScript monorepo using npm workspaces.

## Commands

### Root (runs across all workspaces)
```bash
npm run build         # Build all workspaces
npm run dev           # Dev mode with watch in all workspaces
npm run lint          # Lint all workspaces
npm run typecheck     # Type-check all workspaces
npm run clean         # Clean dist + node_modules everywhere
```

### Hub Server (`apps/hub-server`)
```bash
npm run dev           # tsx watch (auto-reload)
npm run build         # tsc --build
npm run db:migrate    # prisma migrate dev
npm run db:generate   # prisma generate
npm run db:push       # prisma db push (sync schema, no migration)
npm run db:studio     # Prisma Studio UI
```

### Hub Client (`apps/hub-client`)
```bash
npm run dev           # Vite dev server on port 5173
npm run build         # Vite production build
npm run typecheck     # tsc --noEmit
```

### Docker (local full stack)
```bash
docker compose up --build          # Start everything
docker compose up -d postgres      # Just the database for local dev
```
Dashboard: http://localhost:5174 · API: http://localhost:3002 · Default login: `admin@example.com` / `AdminPass123!`

> **macOS note:** The agent inside Docker runs in a Linux VM — for real host metrics on macOS, run lab-agent as a native Node.js process instead.

## Architecture

### Monorepo Layout
```
apps/
  hub-server/    Express + Socket.IO API, JWT auth, Prisma/PostgreSQL
  hub-client/    React 18 + Vite SPA (Tailwind, TanStack Query, Recharts)
  lab-agent/     Lightweight Node.js agent (systeminformation → Socket.IO)
packages/
  shared-types/  Zod schemas + TypeScript types shared across all apps
```

`hub-server` and `hub-client` both import `@overwatch/shared-types` via workspace protocol. All apps extend `tsconfig.base.json` at the root.

### Data Flow
1. `lab-agent` connects to hub over Socket.IO, sends `agent:register`, then emits `agent:heartbeat` (every 15 s) and `agent:metrics` (every 60 s, plus immediately on connect)
2. `hub-server` stores agent state in memory and relays `lab:metrics` events to subscribed dashboard clients
3. `hub-client` subscribes via `dashboard:subscribe` and renders live gauges/sparklines — **metrics are not persisted** (real-time only; persistence is v0.2.0)

### Key Vite Proxy
`vite.config.ts` proxies `/api` and `/socket.io` → `localhost:3001`, so the client dev server needs `hub-server` running separately (or use Docker Compose).

### Database Schema (Prisma)
- `User` — id (UUID), email (unique), name, bcrypt password
- `HomeLab` — id (UUID), name, description, `resourceType` enum (HOMELAB | SERVER | PC), labels[], ownerId (FK cascade delete), optional agentHubUrl, heartbeat/metrics interval overrides

### Auth
JWT HS256, 7-day expiry, set via `JWT_SECRET` env var (enforced at startup in production). Auth endpoints rate-limited to 20 req/15 min; API to 120 req/min.

### Frontend Patterns
- Server state: TanStack Query v5 (`useHomeLabs`, `useLabMetrics`, etc.)
- Auth state: React Context (`AuthContext`)
- Sidebar collapsed state: persisted to `localStorage` key `ui.sidebarCollapsed`
- Custom Tailwind `brand` color palette (sky blue theme)

## Environment Setup

Copy and fill in env files before running locally:
- `apps/hub-server/.env.example` — DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PORT
- `apps/lab-agent/.env.example` — HUB_URL, LAB_ID (UUID of the registered HomeLab)
