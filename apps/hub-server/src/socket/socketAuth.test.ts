import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { socketAuthMiddleware } from "./agentSocket.js";

// test-setup.ts seeds JWT_SECRET before any env.ts import. Read the same
// value the runtime is using so signed tokens validate correctly.
const JWT_SECRET = process.env.JWT_SECRET as string;

function mockSocket(auth: Record<string, unknown> = {}) {
  return {
    handshake: { auth },
    data: {} as { kind?: "agent" | "dashboard"; userId?: string },
  };
}

describe("socketAuthMiddleware (H3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets agent sockets through with no token", () => {
    const socket = mockSocket({ kind: "agent" });
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.kind).toBe("agent");
    expect(socket.data.userId).toBeUndefined();
  });

  it("rejects dashboard sockets with no token", () => {
    const socket = mockSocket({ kind: "dashboard" });
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/missing token/);
    expect(socket.data.userId).toBeUndefined();
  });

  it("defaults to dashboard when handshake.auth.kind is omitted", () => {
    const socket = mockSocket({});
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(socket.data.kind).toBe("dashboard");
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
  });

  it("rejects dashboard sockets with invalid token", () => {
    const socket = mockSocket({ kind: "dashboard", token: "not-a-jwt" });
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/invalid or expired/);
  });

  it("rejects dashboard sockets with expired token", () => {
    const expired = jwt.sign(
      { userId: "u1", email: "a@b.co" },
      JWT_SECRET,
      { expiresIn: -1 }
    );
    const socket = mockSocket({ kind: "dashboard", token: expired });
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/invalid or expired/);
  });

  it("accepts a valid dashboard token and attaches userId", () => {
    const good = jwt.sign({ userId: "u42", email: "x@y.co" }, JWT_SECRET);
    const socket = mockSocket({ kind: "dashboard", token: good });
    const next = vi.fn();

    socketAuthMiddleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe("u42");
    expect(socket.data.kind).toBe("dashboard");
  });
});
