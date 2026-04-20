import { useContext } from "react";
import { AuthContext, type AuthUser } from "../contexts/AuthContext";

export type { AuthUser };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
