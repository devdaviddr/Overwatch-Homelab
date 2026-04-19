import { NavLink } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Server,
  LogOut,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";

export function Sidebar() {
  const { token, user, logout } = useAuth();
  const { data: labs, isLoading } = useHomeLabs(token);

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
        <Shield className="h-7 w-7 text-brand-500" />
        <span className="text-lg font-bold text-white">Overwatch</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <NavLink
          to="/overview"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-900/50 text-brand-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>

        {/* Homelabs section */}
        <div className="mt-4">
          <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Homelabs
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
            </div>
          )}

          {labs?.map((lab) => (
            <NavLink
              key={lab.id}
              to={`/labs/${lab.id}`}
              className={({ isActive }) =>
                `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-brand-900/50 text-brand-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <span className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="truncate">{lab.name}</span>
              </span>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </NavLink>
          ))}

          {!isLoading && labs?.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-600 italic">No labs configured</p>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="ml-2 p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
