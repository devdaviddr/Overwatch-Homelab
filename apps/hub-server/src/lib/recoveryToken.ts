import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// 32 bytes = 64 hex chars = 256 bits of entropy. Matches shared-types
// ResetPasswordSchema (length 64, hex-only).
const RECOVERY_TOKEN_BYTES = 32;
const BCRYPT_COST = 12;

export function generateRecoveryToken(): string {
  return randomBytes(RECOVERY_TOKEN_BYTES).toString("hex");
}

export function hashRecoveryToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_COST);
}

export function verifyRecoveryToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
