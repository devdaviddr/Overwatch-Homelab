import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { apiFetch } from "../lib/api.ts";
import { RecoveryTokenModal } from "../components/RecoveryTokenModal.tsx";

type Tab = "signin" | "signup" | "reset";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>("signin");

  // After signup/reset success we hold the one-time recovery token here so
  // we can show it in RecoveryTokenModal before completing the login.
  const [pendingAuth, setPendingAuth] = useState<
    | null
    | { token: string; user: AuthUser; recoveryToken: string; context: "signup" | "reset" }
  >(null);

  function completePendingAuth() {
    if (!pendingAuth) return;
    login(pendingAuth.token, pendingAuth.user);
    setPendingAuth(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md px-8 py-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
        <div className="flex flex-col items-center mb-6">
          <Shield className="h-10 w-10 text-brand-500 mb-2" />
          <h1 className="text-xl font-bold text-white">Overwatch Homelab</h1>
        </div>

        <div
          role="tablist"
          className="flex items-center gap-1 mb-6 p-1 bg-gray-950 border border-gray-800 rounded-lg"
        >
          <TabButton active={tab === "signin"} onClick={() => setTab("signin")}>
            Sign in
          </TabButton>
          <TabButton active={tab === "signup"} onClick={() => setTab("signup")}>
            Sign up
          </TabButton>
          <TabButton active={tab === "reset"} onClick={() => setTab("reset")}>
            Reset
          </TabButton>
        </div>

        {tab === "signin" && (
          <SignInForm
            onSuccess={(token, user) => login(token, user)}
            onSwitchToReset={() => setTab("reset")}
          />
        )}
        {tab === "signup" && (
          <SignUpForm
            onSuccess={(d) => setPendingAuth({ ...d, context: "signup" })}
          />
        )}
        {tab === "reset" && (
          <ResetForm
            onSuccess={(d) => setPendingAuth({ ...d, context: "reset" })}
          />
        )}
      </div>

      {pendingAuth && (
        <RecoveryTokenModal
          token={pendingAuth.recoveryToken}
          context={pendingAuth.context}
          onClose={completePendingAuth}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Tab button ────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Shared field ──────────────────────── */

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  hint,
  required = true,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-mono text-gray-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {hint && <p className="text-[11px] font-mono text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

/* ───────────────────────── Sign in ───────────────────────────── */

function SignInForm({
  onSuccess,
  onSwitchToReset,
}: {
  onSuccess: (token: string, user: AuthUser) => void;
  onSwitchToReset: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      onSuccess(res.data.token, res.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="signin-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field id="signin-password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={onSwitchToReset}
        className="w-full text-[11px] text-gray-500 hover:text-gray-300 font-mono uppercase tracking-wide"
      >
        Forgot password? →
      </button>
    </form>
  );
}

/* ───────────────────────── Sign up ───────────────────────────── */

function SignUpForm({
  onSuccess,
}: {
  onSuccess: (d: { token: string; user: AuthUser; recoveryToken: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser; recoveryToken: string }>(
        "/api/auth/register",
        { method: "POST", body: { email, name, password } }
      );
      onSuccess(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="signup-name" label="Name" value={name} onChange={setName} autoComplete="name" />
      <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        id="signup-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Minimum 12 characters, must include at least one letter and one digit."
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

/* ───────────────────────── Reset ─────────────────────────────── */

function ResetForm({
  onSuccess,
}: {
  onSuccess: (d: { token: string; user: AuthUser; recoveryToken: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser; recoveryToken: string }>(
        "/api/auth/reset-password",
        { method: "POST", body: { email, recoveryToken: recoveryToken.trim(), newPassword } }
      );
      onSuccess(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="reset-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field
        id="reset-token"
        label="Recovery token"
        value={recoveryToken}
        onChange={setRecoveryToken}
        hint="64-character token you saved when you signed up."
      />
      <Field
        id="reset-new-password"
        label="New password"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        hint="Minimum 12 characters, letter + digit."
      />
      <Field
        id="reset-confirm"
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
