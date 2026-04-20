import { describe, it, expect } from "vitest";
import { ResetPasswordSchema } from "@overwatch/shared-types";

const validToken = "a".repeat(64);

describe("ResetPasswordSchema", () => {
  it("accepts a valid body", () => {
    const r = ResetPasswordSchema.safeParse({
      email: "user@example.com",
      recoveryToken: validToken,
      newPassword: "abcdefgh1234",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-hex recovery token", () => {
    const r = ResetPasswordSchema.safeParse({
      email: "user@example.com",
      recoveryToken: "z".repeat(64),
      newPassword: "abcdefgh1234",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a short recovery token", () => {
    const r = ResetPasswordSchema.safeParse({
      email: "user@example.com",
      recoveryToken: "abc",
      newPassword: "abcdefgh1234",
    });
    expect(r.success).toBe(false);
  });

  it("applies the v0.2.0 password policy to newPassword", () => {
    const r = ResetPasswordSchema.safeParse({
      email: "user@example.com",
      recoveryToken: validToken,
      newPassword: "short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = ResetPasswordSchema.safeParse({
      email: "not-an-email",
      recoveryToken: validToken,
      newPassword: "abcdefgh1234",
    });
    expect(r.success).toBe(false);
  });
});
