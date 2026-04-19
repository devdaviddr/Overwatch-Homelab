import { io, Socket } from "socket.io-client";

// Single shared socket connection for the whole app.
// Uses a relative URL so nginx proxies it to hub-server.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("/", {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
