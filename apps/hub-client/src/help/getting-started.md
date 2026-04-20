# Getting Started with Overwatch Homelab

## What is Overwatch Homelab?

Overwatch Homelab is a lightweight, real-time monitoring platform for your home lab infrastructure. A small agent runs on each machine you want to monitor and streams live system metrics — CPU, RAM, disk, and network — to a central hub, which displays them on your dashboard.

## Key Concepts

| Term | What it means |
|---|---|
| **Resource** | A machine or service you want to monitor (PC, server, NAS, etc.) |
| **Agent** | A lightweight Node.js process running on the monitored machine |
| **Hub** | The central server that receives metrics and serves the dashboard |

---

## Creating Your First Resource

1. Click **+ New Resource** on the Overview page.
2. **Basic Info** — enter a name and optional description.
3. **Type & Labels** — choose HomeLab, Server, or PC. Add optional labels like `linux`, `nas`, or `media-server` for filtering.
4. **Agent Configuration** — set the Hub URL and polling intervals, or leave the defaults.
5. Click **Create Resource**.

> On macOS with a native (non-Docker) hub the agent starts automatically. On other platforms, follow the snippet in the **Configuration** tab of your new resource.

---

## Navigating the Dashboard

### Overview
The Overview page is a bird's-eye view of every resource you've added. Each card shows:
- Online / Offline status
- Live CPU and RAM usage gauges
- Resource type and labels

### Resource page
Click any resource from the sidebar or Overview to open its detail page. Tabs include:

- **Metrics** — live gauges for CPU per-core, RAM, disk mounts, and network throughput
- **Configuration** — agent connection settings, Start/Stop controls (macOS native hub), and copy-ready setup snippets

---

## Live Metrics

The agent communicates via Socket.IO and sends two event types:

- **Heartbeat** — every 15 seconds; keeps the resource marked as *online*
- **Metrics snapshot** — every 60 seconds (and once immediately on connect) containing CPU, RAM, disk, and network data

> **Note:** Metrics are real-time only in v0.1.x — they are not persisted to disk. Historical storage is planned for v0.2.0.

---

## What's Next?

- Follow the **Agent Setup** guide to install and configure the agent on your OS.
- Check the **FAQ** if you run into any issues.
