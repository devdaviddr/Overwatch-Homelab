import { describe, it, expect } from "vitest";
import {
  CreateUserSchema,
  PasswordPolicySchema,
  UpdateProfileSchema,
} from "@overwatch/shared-types";

describe("v0.2.0 password policy (H6)", () => {
  it("accepts a 12-char password with at least one letter and one digit", () => {
    const r = PasswordPolicySchema.safeParse("abcdefgh1234");
    expect(r.success).toBe(true);
  });

  it("rejects passwords shorter than 12 characters", () => {
    const r = PasswordPolicySchema.safeParse("a1b2c3d4e5f");
    expect(r.success).toBe(false);
  });

  it("rejects all-letters passwords", () => {
    const r = PasswordPolicySchema.safeParse("abcdefghijkl");
    expect(r.success).toBe(false);
  });

  it("rejects all-digits passwords", () => {
    const r = PasswordPolicySchema.safeParse("123456789012");
    expect(r.success).toBe(false);
  });

  it("applies the same policy through CreateUserSchema", () => {
    const r = CreateUserSchema.safeParse({ email: "a@b.co", name: "x", password: "short1" });
    expect(r.success).toBe(false);
  });

  it("UpdateProfileSchema requires currentPassword when newPassword is given", () => {
    const r = UpdateProfileSchema.safeParse({ newPassword: "abcdefgh1234" });
    expect(r.success).toBe(false);
  });

  it("UpdateProfileSchema accepts name-only updates", () => {
    const r = UpdateProfileSchema.safeParse({ name: "New Name" });
    expect(r.success).toBe(true);
  });

  it("UpdateProfileSchema rejects when both fields are absent", () => {
    const r = UpdateProfileSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("UpdateProfileSchema accepts valid password change", () => {
    const r = UpdateProfileSchema.safeParse({
      currentPassword: "anything",
      newPassword: "abcdefgh1234",
    });
    expect(r.success).toBe(true);
  });
});
