import { useState } from "react";
import { User as UserIcon, KeyRound, Loader2, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { apiFetch } from "../lib/api.ts";

interface UpdatedUser {
  id: string;
  email: string;
  name: string;
}

export function ProfilePage() {
  const { token, user, login } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === user?.name) return;
    setNameStatus("saving");
    setNameError(null);
    try {
      const res = await apiFetch<UpdatedUser>("/api/auth/profile", {
        token,
        method: "PATCH",
        body: { name: name.trim() },
      });
      login(token!, res.data);
      setNameStatus("saved");
    } catch (err) {
      setNameStatus("error");
      setNameError(err instanceof Error ? err.message : "Failed to update name");
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match");
      setPwStatus("error");
      return;
    }
    setPwStatus("saving");
    try {
      await apiFetch("/api/auth/profile", {
        token,
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      setPwStatus("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwStatus("error");
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your display name and password.</p>
      </div>

      <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="h-4 w-4 text-gray-500" />
          <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">Display name</span>
        </div>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-gray-500 mb-1">Email</label>
            <input
              readOnly
              value={user?.email ?? ""}
              className="w-full bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-gray-500 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
            />
          </div>
          {nameError && <p className="text-xs text-red-400 font-mono">{nameError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nameStatus === "saving" || !name.trim() || name === user?.name}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-100 bg-brand-600 hover:bg-brand-500 border border-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {nameStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save name
            </button>
            {nameStatus === "saved" && (
              <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                saved
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-4 w-4 text-gray-500" />
          <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-gray-500">Change password</span>
        </div>
        <form onSubmit={savePassword} className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-gray-500 mb-1">Current password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-gray-500 mb-1">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              required
              minLength={12}
            />
            <p className="text-[11px] text-gray-600 font-mono mt-1">
              Minimum 12 characters, must include at least one letter and one digit.
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-gray-500 mb-1">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              required
            />
          </div>
          {pwError && <p className="text-xs text-red-400 font-mono">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pwStatus === "saving" || !currentPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-100 bg-brand-600 hover:bg-brand-500 border border-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Change password
            </button>
            {pwStatus === "saved" && (
              <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                password updated
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
