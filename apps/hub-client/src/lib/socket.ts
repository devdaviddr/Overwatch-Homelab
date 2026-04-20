import { io, Socket } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "overwatch_token";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
      // H3: dashboard sockets present a JWT on handshake. The server verifies
      // it in io.use() middleware and authorises dashboard:subscribe against
      // HomeLab.ownerId.
      auth: (cb) => {
        const token = localStorage.getItem(TOKEN_KEY);
        cb({ kind: "dashboard", token });
      },
    });
  }
  return socket;
}

// Called on login/logout so the handshake picks up the new token on next connect.
export function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
