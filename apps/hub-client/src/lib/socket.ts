import { io, Socket } from "socket.io-client";

// Connect directly to hub-server using the same base URL as the REST API,
// so socket.io bypasses the nginx proxy (same path as api.ts).
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
