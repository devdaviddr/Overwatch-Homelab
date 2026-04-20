# Frequently Asked Questions

## Account & Access

### How do I reset my password?

Self-service password reset is not yet available in v0.1.x. An admin must update your password directly in the database.

**If you are the admin and have access to the server:**

1. Start Prisma Studio:

```bash
cd apps/hub-server
npm run db:studio
```

2. Open **http://localhost:5555** in your browser.
3. Navigate to the **User** table and find your account.
4. Generate a bcrypt hash for your new password:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourNewPassword', 12).then(h => console.log(h));"
```

5. Paste the hash into the `password` field and save.

> Self-service password reset via email is planned for a future release.

---

### How do I change my display name or email?

Use Prisma Studio (same steps as above) and update the `name` or `email` fields on your User record.

---

### How do I create additional user accounts?

The public registration endpoint is disabled by default in production. To add a user, insert a record via Prisma Studio with a bcrypt-hashed password (cost factor 12).

---

## Metrics & Agents

### Why is my resource showing "AGENT OFFLINE"?

The hub marks an agent offline when it hasn't received a heartbeat in 2× the heartbeat interval (default: 30 seconds). Common causes:

- The agent process stopped or crashed — check the terminal or service logs.
- A network issue between the agent machine and the hub.
- The `LAB_ID` or `HUB_URL` environment variables are incorrect.
- The hub server restarted — it loses in-memory agent state on restart. The agent will automatically reconnect and come back online within one heartbeat interval.

---

### My metrics aren't updating — what should I check?

1. Confirm the resource shows **AGENT ONLINE** on the Overview page.
2. Metrics are pushed every 60 seconds by default. Wait up to a minute after the agent first connects.
3. Open browser DevTools and check the Console for Socket.IO errors.
4. Verify no firewall or proxy is blocking WebSocket connections to the hub port.

---

### Why do I see VM specs on my Mac instead of real hardware metrics?

You're running the agent inside Docker on macOS. Docker on macOS runs a Linux VM, so the agent reports the VM's CPU and RAM rather than your Mac's real hardware. Switch to the native setup — see **Agent Setup → macOS**.

---

### Are my metrics stored to disk?

No — v0.1.x is real-time only. Metrics exist only in memory and are cleared when the hub restarts. Persistent historical storage is planned for v0.2.0.

---

### What data does the agent collect?

The agent collects only system-level performance counters:

- **CPU** — overall load %, per-core usage, model name, clock speed
- **Memory** — total, used, free, swap
- **Disk** — per-mount point size, used, and available space
- **Network** — bytes sent and received per network interface
- **OS** — hostname, platform, and uptime

No files, processes, environment variables, or network traffic contents are ever collected or transmitted.

---

## Resources & Configuration

### How do I delete a resource?

Open the resource detail page, click the **Edit** (pencil) icon in the header, and choose **Delete Resource**. This removes the resource from the dashboard. Any agent process running for that resource will continue until you stop it manually.

---

### Can I monitor multiple machines?

Yes — create one resource per machine in the dashboard. Each machine runs its own `lab-agent` instance using a unique `LAB_ID`. All agents report to the same hub.

---

### How do I update the Hub URL or intervals after a resource is created?

Open the resource, go to the **Configuration** tab, and update the settings. You'll then need to restart the agent with the new environment variables for the change to take effect.

---

### The agent won't start — "Cannot find module tsx" or similar

Make sure you've installed all dependencies from the repo root:

```bash
npm install
```

If `npx tsx` is still not found, try using the local binary directly:

```bash
LAB_ID=<id> HUB_URL=<url> node_modules/.bin/tsx apps/lab-agent/src/index.ts
```

---

## Hub Server

### What port does the hub run on?

The hub listens on port **3001** by default (configurable via the `PORT` env var in `apps/hub-server/.env`). The `docker-compose.yaml` maps this to **3002** on the host.

---

### How do I change the JWT secret?

Set a new value for `JWT_SECRET` in `apps/hub-server/.env`. Use a long random string in production:

```bash
openssl rand -base64 48
```

> **Important:** Changing the secret immediately invalidates all existing login sessions. All users will be logged out.

---

### Can I run the hub behind a reverse proxy (nginx, Caddy)?

Yes. Your proxy must pass WebSocket upgrade headers. Example nginx config:

```nginx
location / {
    proxy_pass         http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

For Caddy, add `@websockets` matchers or use `reverse_proxy` — Caddy handles WebSocket upgrades automatically.
