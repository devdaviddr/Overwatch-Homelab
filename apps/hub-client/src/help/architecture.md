# System Architecture

## Overview

Overwatch Homelab is a TypeScript monorepo composed of three apps and one shared package. A lightweight agent runs on each monitored machine and streams metrics in real time to a central hub, which serves them to the React dashboard over WebSockets.

```
monorepo/
├── apps/
│   ├── hub-server/     Express + Socket.IO API, JWT auth, Prisma/PostgreSQL
│   ├── hub-client/     React 18 SPA (Vite, TanStack Query, Recharts)
│   └── lab-agent/      Lightweight Node.js metrics collector
└── packages/
    └── shared-types/   Zod schemas + TypeScript types (imported by all three apps)
```

---

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Monitored Machine                        │
│                                                                 │
│  ┌─────────────────────────────────┐                           │
│  │           lab-agent             │                           │
│  │                                 │                           │
│  │  systeminformation              │                           │
│  │    CPU / RAM / Disk / Network   │                           │
│  │         │                       │                           │
│  │         ▼                       │                           │
│  │  Socket.IO client               │                           │
│  └──────────┬──────────────────────┘                           │
└─────────────┼───────────────────────────────────────────────────┘
              │  WebSocket (Socket.IO)
              │  agent:register
              │  agent:heartbeat  (every 15 s)
              │  agent:metrics    (every 60 s)
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          hub-server                             │
│                                                                 │
│  ┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐  │
│  │  Express API │   │  Socket.IO hub  │   │  Agent Registry │  │
│  │              │   │                 │   │  (in-memory Map)│  │
│  │  /api/auth   │   │  agent:*        │   │                 │  │
│  │  /api/homelabs│  │  dashboard:*    │   │  labId → state  │  │
│  │  /api/agent  │   │  lab:metrics →  │   │  lastSeen       │  │
│  └──────┬───────┘   └────────┬────────┘   │  pid / status   │  │
│         │                    │            └─────────────────┘  │
│         ▼                    │                                  │
│  ┌──────────────┐            │ lab:metrics broadcast            │
│  │   Prisma ORM │            │                                  │
│  └──────┬───────┘            │                                  │
│         │                    │                                  │
└─────────┼────────────────────┼─────────────────────────────────┘
          │ SQL                │ WebSocket (Socket.IO)
          ▼                    ▼
┌──────────────┐   ┌──────────────────────────────────────────────┐
│  PostgreSQL  │   │                 hub-client                   │
│              │   │                                              │
│  User        │   │  ┌─────────────────┐  ┌──────────────────┐  │
│  HomeLab     │   │  │  TanStack Query │  │  Socket.IO client│  │
└──────────────┘   │  │  REST → /api/*  │  │  dashboard:sub   │  │
                   │  │  useHomeLabs    │  │  lab:metrics     │  │
                   │  │  useLabMetrics  │  │  → live gauges   │  │
                   │  └─────────────────┘  └──────────────────┘  │
                   │                                              │
                   │  React Router  AuthContext  Recharts         │
                   └──────────────────────────────────────────────┘
```

---

## Data Flows

### 1 — Agent Registration & Heartbeat

```
lab-agent                          hub-server
    │                                   │
    │── connect (Socket.IO) ──────────► │
    │                                   │  store socket in AgentRegistry[labId]
    │── agent:register { labId } ─────► │
    │                                   │  mark agent ONLINE
    │── agent:metrics { ... } ────────► │  (sent immediately on connect)
    │                                   │
    │   ··· every 15 s ···              │
    │── agent:heartbeat { labId } ────► │  update lastSeen timestamp
    │                                   │
    │   ··· every 60 s ···              │
    │── agent:metrics { cpu, ram... } ► │  relay → all subscribed dashboard clients
    │                                   │
    │── disconnect ───────────────────► │  mark agent OFFLINE
```

### 2 — Dashboard Subscription & Live Metrics

```
hub-client                         hub-server
    │                                   │
    │── dashboard:subscribe { labId } ► │  add client to subscribers[labId]
    │                                   │
    │                                   │  ··· on agent:metrics received ···
    │◄── lab:metrics { labId, data } ── │  broadcast to subscribers[labId]
    │                                   │
    │  useLabMetrics hook updates       │
    │  Recharts re-renders gauges       │
    │                                   │
    │── dashboard:unsubscribe ────────► │  remove from subscribers[labId]
```

### 3 — Authentication Flow

```
hub-client                         hub-server                PostgreSQL
    │                                   │                         │
    │── POST /api/auth/login ─────────► │                         │
    │   { email, password }             │── SELECT user ─────────►│
    │                                   │◄── user row ────────────│
    │                                   │  bcrypt.compare(pw)     │
    │◄── { token: JWT (7d) } ────────── │                         │
    │                                   │                         │
    │  store token in AuthContext       │                         │
    │                                   │                         │
    │── GET /api/homelabs ────────────► │                         │
    │   Authorization: Bearer <token>   │  verifyJWT middleware   │
    │                                   │── SELECT homelabs ─────►│
    │◄── [ HomeLab, ... ] ──────────── │◄── rows ────────────────│
```

### 4 — macOS Agent Auto-Launch

```
hub-client (wizard)                hub-server
    │                                   │
    │  user clicks Create Resource      │
    │── POST /api/homelabs ───────────► │  persist HomeLab row
    │◄── { id: labId } ─────────────── │
    │                                   │
    │── GET /api/agent/capabilities ──► │  check /.dockerenv
    │◄── { canLaunch: true } ────────── │  (false if inside Docker)
    │                                   │
    │── POST /api/agent/:labId/launch ► │  spawn tsx lab-agent/src/index.ts
    │                                   │  with LAB_ID + HUB_URL env vars
    │◄── { running: true, pid } ─────── │  store in agentProcesses Map
    │                                   │
    │  show "Agent started" in wizard   │
```

---

## Persistence Model

| Data | Where stored | Lifetime |
|---|---|---|
| Users, HomeLabs | PostgreSQL (Prisma) | Permanent |
| Agent online/offline state | hub-server memory | Until hub restart |
| Active metrics data | hub-server memory → client memory | Real-time only; lost on refresh |
| Spawned agent PIDs (macOS) | hub-server memory Map | Until hub restart |
| Sidebar collapsed state | Browser `localStorage` | Per-browser, persistent |
| Auth token | React context (memory) | Until page reload / logout |

> **v0.2.0 plan:** Persist metrics snapshots to PostgreSQL with time-series queries to enable historical charts and alerting.

---

## Tech Stack Reference

| Layer | Technology |
|---|---|
| Agent metrics collection | `systeminformation` |
| Real-time transport | Socket.IO 4 (WebSocket + polling fallback) |
| API server | Express 4, TypeScript, `tsx` watch |
| Auth | JWT HS256, `jsonwebtoken`, bcrypt |
| ORM / migrations | Prisma 5, PostgreSQL |
| Rate limiting | `express-rate-limit` (auth: 20/15 min, API: 120/min) |
| Frontend build | Vite 5, React 18, TypeScript |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Styling | Tailwind CSS v3, custom `brand` palette (sky blue) |
| Shared types | Zod schemas compiled to TypeScript types |
