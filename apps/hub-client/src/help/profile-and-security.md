# Profile & Security

## Profile

Click your name in the bottom-left of the sidebar to open the **Profile** page. You can:

- **Change display name** — the name shown throughout the UI. Save updates immediately across the app.
- **Change password** — requires your current password plus the new one twice. The new password must meet the v0.2.0 policy.

Your email is shown read-only for reference and can't be changed from the UI in v0.2.0.

## Password policy (v0.2.0)

- **Minimum 12 characters**
- At least **one letter**
- At least **one digit**

This applies equally to registration and password changes. A rejected password returns a server-side validation error explaining which rule failed.

Passwords are hashed with bcrypt (cost factor 12). The plaintext never leaves the server's request handler.

## Dashboard socket authentication

The browser's Socket.IO connection presents your JWT on handshake, and the hub:

1. Verifies the token with the server's `JWT_SECRET`.
2. Attaches your `userId` to the socket.
3. On `dashboard:subscribe`, checks that `HomeLab.ownerId === socket.userId` before joining the broadcast room.

A subscription request for a resource you don't own is rejected with `hub:error FORBIDDEN`. No live metrics ever leak across users.

## Agent socket (v0.2.0 trade-off)

The agent-side Socket.IO connection is **not** JWT-authenticated in v0.2.0 — it presents `{ kind: "agent" }` on handshake and registers with the `LAB_ID` UUID.

This is intentional, with two caveats:

- The `LAB_ID` is a UUID (128 bits of entropy) and functions as a capability — without it an attacker can't claim to be a specific lab.
- The `LAB_ID` should be treated as a secret. Don't paste it into public repos or screenshots.

Rotating agent authentication to JWT-based credentials is planned for v0.3.0. Until then, on shared networks run the lab-agent behind a firewall that only allows outbound connections to your hub.

## Environment hygiene

- The hub **refuses to boot** if `DATABASE_URL`, `JWT_SECRET`, or `CORS_ORIGIN` are missing or malformed. The error message lists the specific fields that failed.
- There is no dev fallback for `JWT_SECRET`. Generate one with `openssl rand -hex 32` and set it via your `.env` file or shell export.
- `docker-compose.yaml` references `${JWT_SECRET:?...}`, so Docker Compose also refuses to start without it being set.

## Rate limits

- **Auth endpoints** (`/api/auth/*`): 20 requests per 15 minutes per IP
- **API endpoints** (`/api/homelabs/*`, `/api/agent/*`, `/api/agents/*`): 120 requests per minute per IP

If you see repeated `429 TOO_MANY_REQUESTS` during development, wait the window out — the server returns `Retry-After` headers.
