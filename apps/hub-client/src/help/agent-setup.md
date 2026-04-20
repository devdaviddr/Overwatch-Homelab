# Agent Setup

The Overwatch agent (`lab-agent`) is a lightweight Node.js process that collects system metrics and streams them to the hub over Socket.IO. This page covers setup on every supported platform.

## Before You Start

You need:
- A resource already created in the dashboard (see **Getting Started**)
- The **Lab ID** (UUID) for that resource — shown in the Configuration tab
- The **Hub URL** — the address of your hub server, e.g. `http://192.168.1.10:3002`
- Node.js 18+ installed on the monitored machine

---

## macOS — Native (Recommended)

> **Why not Docker on macOS?** Docker on macOS runs in a Linux VM. The agent would report the VM's specs instead of your Mac's real CPU, RAM, and disk. Always run the agent natively on macOS.

### Automatic launch (wizard)

When you create a resource on a macOS machine where the hub is running natively, the wizard detects this and starts the agent automatically. You should see **Agent started — will connect shortly** in the final step.

### Manual start

```bash
LAB_ID=<your-lab-id> \
HUB_URL=http://localhost:3002 \
npx tsx apps/lab-agent/src/index.ts
```

### Persistent background service (launchd)

Create `~/Library/LaunchAgents/com.overwatch.lab-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.overwatch.lab-agent</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>npx</string>
      <string>tsx</string>
      <string>/absolute/path/to/overwatch/apps/lab-agent/src/index.ts</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>LAB_ID</key><string>your-lab-id-here</string>
      <key>HUB_URL</key><string>http://localhost:3002</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/overwatch-agent.log</string>
    <key>StandardErrorPath</key><string>/tmp/overwatch-agent.err</string>
  </dict>
</plist>
```

Load and start it:

```bash
launchctl load ~/Library/LaunchAgents/com.overwatch.lab-agent.plist
launchctl start com.overwatch.lab-agent
```

---

## Linux — Native

### One-liner start

```bash
LAB_ID=<your-lab-id> \
HUB_URL=http://<hub-ip>:3002 \
npx tsx /path/to/overwatch/apps/lab-agent/src/index.ts
```

### Persistent background service (systemd)

Create `/etc/systemd/system/overwatch-agent.service`:

```ini
[Unit]
Description=Overwatch Lab Agent
After=network.target

[Service]
Type=simple
Restart=on-failure
RestartSec=10
Environment="LAB_ID=<your-lab-id>"
Environment="HUB_URL=http://<hub-ip>:3002"
ExecStart=/usr/bin/npx tsx /path/to/overwatch/apps/lab-agent/src/index.ts

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable overwatch-agent
sudo systemctl start overwatch-agent
sudo systemctl status overwatch-agent
```

---

## Windows — Native

Open PowerShell and run:

```powershell
$env:LAB_ID  = "<your-lab-id>"
$env:HUB_URL = "http://<hub-ip>:3002"
npx tsx C:\path\to\overwatch\apps\lab-agent\src\index.ts
```

For a persistent service, use [NSSM](https://nssm.cc/) (Non-Sucking Service Manager) or Windows Task Scheduler to keep the agent running in the background.

---

## Docker (Linux/Windows hosts only)

> **Do not use Docker on macOS** — it reports VM specs instead of host specs.

Using the included `docker-compose.yaml`:

```bash
docker compose up lab-agent
```

Or as a standalone container with env vars:

```bash
docker run \
  -e LAB_ID=<your-lab-id> \
  -e HUB_URL=http://<hub-ip>:3002 \
  overwatch/lab-agent
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `LAB_ID` | **Yes** | — | UUID of the resource in the dashboard |
| `HUB_URL` | **Yes** | — | Full URL to the hub server (include `http://` and port) |
| `HEARTBEAT_INTERVAL_MS` | No | `15000` | How often a heartbeat is sent (ms, min 1000) |
| `METRICS_INTERVAL_MS` | No | `60000` | How often a full metrics snapshot is sent (ms, min 5000) |

---

## Verifying the Connection

After starting the agent, check the Overview page. The resource should show **AGENT ONLINE** within a few seconds. If it stays offline:

1. Confirm the hub server is running and reachable from the agent machine (`curl http://<hub-ip>:3002/api/health`).
2. Double-check `LAB_ID` matches the UUID shown in the Configuration tab.
3. Check firewall rules — the hub port (default `3001` or `3002`) must be open for inbound TCP.
4. Look at the agent's terminal/log output for Socket.IO connection errors.
