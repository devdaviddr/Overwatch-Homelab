# Getting Started with Overwatch Homelab

Overwatch is a local monitoring platform. You run a hub (database + API + dashboard) once, then deploy a small agent on each machine you want to watch. Metrics stream live to the browser — CPU, memory, disk, network, uptime.

---

## 1. Start the hub

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Dashboard | http://localhost:5174 |
| API | http://localhost:3002 |

First time? Default account: `admin@example.com` / `AdminPass123!`

---

## 2. Create a Resource

A **Resource** represents one machine you want to monitor.

1. Click **New Resource** (top-right of the Overview page).
2. **Step 1 — Basic Info:** Give it a name (e.g. `Mac Mini`) and an optional description.
3. **Step 2 — Type & Labels:** Pick PC, Server, or Homelab. Add labels like `home`, `storage`, `dev`.
4. **Step 3 — Agent Configuration:** Set the Hub URL the agent will connect to.
   - Your platform is auto-detected. On macOS the wizard locks to native mode — Docker is not available on Mac (see below).
   - Running the agent on the **same Mac** as Docker? Use `http://localhost:3002`.
   - Running on a **different machine** on your network? Use `http://<your-mac-ip>:3002`.
   - Adjust heartbeat/metrics intervals if needed (defaults: 15 s / 60 s).
5. **Step 4 — Review:** Confirm and click **Create Resource**.

---

## 3. Start the agent

### macOS — automatic

If the hub is running natively (i.e. via `npm run dev`, not Docker Compose), the wizard starts the agent for you automatically after you click **Create Resource**. You'll see "Agent started — will connect shortly" in the wizard, and the resource page will show **AGENT ONLINE** within a few seconds. Nothing else to do.

If the hub is running inside Docker Compose, automatic launch is not available (Docker can't spawn native Mac processes). Use the one-liner below instead.

### macOS — manual one-liner

From the resource's **Configuration** tab, copy the one-liner under **Native**:

```bash
LAB_ID=<uuid> HUB_URL=http://localhost:3002 HEARTBEAT_INTERVAL_MS=15000 METRICS_INTERVAL_MS=60000 npx tsx apps/lab-agent/src/index.ts
```

No build step needed — `tsx` runs the agent directly from source.

### Linux — native or Docker

**Native:**
Copy the `.env` snippet from the **Configuration** tab into `apps/lab-agent/.env`, then run the one-liner:

```bash
npx tsx apps/lab-agent/src/index.ts
```

**Docker:**
Update `docker-compose.yaml` with the resource's LAB_ID and restart:

```yaml
lab-agent:
  environment:
    HUB_URL: "http://hub-server:3001"
    LAB_ID: "<uuid-from-dashboard>"
```

```bash
docker compose up lab-agent -d --force-recreate
```

---

## 4. Connect a running agent to a resource

If an agent is already running (connected to the hub with a different LAB_ID), you don't need to restart it.

1. Open the resource's **Configuration** tab.
2. The **Detected Agents** panel lists every agent currently connected to the hub, refreshing every 10 seconds.
3. Agents showing a **yellow dot** are connected but assigned to a different resource. Click **Connect** to reassign the agent live — no restart needed.
4. The agent switches its LAB_ID in memory and begins streaming metrics to this resource immediately.

---

## 5. Stop or restart the agent

On the **Configuration** tab, the **Local Agent** section (visible when the hub is running natively) shows whether a managed agent is running for this resource. Use the **Stop** and **Start on this Mac** buttons to control it without touching the terminal.

---

## 6. View live metrics

Once the agent is connected, the resource header switches from **AGENT OFFLINE** to **AGENT ONLINE**.

Click the **Monitor** tab to see:

- **CPU** — usage %, core count, model, temperature (where available)
- **Memory** — RAM and swap usage with 30-point sparklines
- **Disk** — per-mount usage grid (size, used, type)
- **Network** — per-interface grid (IP, speed, state)
- **OS** — platform, hostname, arch, uptime

Metrics refresh every 60 seconds by default (configurable per resource).

---

## 7. Sidebar

The left sidebar lists all your resources.

- Click the **chevron** (top of the sidebar) to collapse it to icon-only mode — hover any icon to see a tooltip with the resource name, type, and labels.
- Collapse state is saved in your browser and persists across reloads.

---

## Troubleshooting

**Agent offline even though it's running**
- Check the agent terminal for connection errors.
- Confirm `HUB_URL` in the agent's `.env` (or the one-liner) is reachable from the machine the agent is running on.
- On macOS with Docker: use `http://localhost:3002`, not `http://hub-server:3001` (that internal hostname only works inside Docker's network).

**"Failed to fetch" when creating a resource**
- Hub-server isn't running. Start it: `docker compose up hub-server postgres -d`

**Automatic agent launch didn't work**
- The hub must be running natively (`npm run dev`) for auto-launch to work. When running in Docker Compose the hub can't spawn Mac processes — use the manual one-liner instead.
- Check that `node_modules/.bin/tsx` exists at the repo root (`npm install` from root if not).

**Detected Agents shows the agent but metrics don't appear**
- The first metrics push happens immediately on connect. If nothing appears after ~5 seconds, check the agent logs for errors collecting metrics.
- Subsequent pushes follow `METRICS_INTERVAL_MS` (default 60 s).

**Docker agent reports wrong specs (4 CPU / ~7 GB RAM)**
- This is the Docker Desktop Linux VM, not your Mac. The wizard blocks Docker mode on macOS for this reason. Run the agent natively instead.
