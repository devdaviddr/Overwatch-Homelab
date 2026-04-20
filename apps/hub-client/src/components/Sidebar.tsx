import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Shield,
  LayoutDashboard,
  Server,
  Database,
  Monitor,
  LogOut,
  ChevronRight,
  Loader2,
  HelpCircle,
  PlayCircle,
  Cpu,
  Network,
} from "lucide-react";

const HELP_TOPICS = [
  { id: "getting-started", title: "Getting Started", icon: PlayCircle },
  { id: "agent-setup", title: "Agent Setup", icon: Cpu },
  { id: "architecture", title: "Architecture", icon: Network },
  { id: "faq", title: "FAQ", icon: HelpCircle },
];
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceTypes.ts";
import type { ResourceType } from "@overwatch/shared-types";

function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const { iconName } = RESOURCE_TYPE_CONFIG[type];
  if (iconName === "database") return <Database className={className} />;
  if (iconName === "monitor") return <Monitor className={className} />;
  return <Server className={className} />;
}

function IconBox({ type, className, children }: { type: ResourceType; className?: string; children?: any }) {
  const cfg = RESOURCE_TYPE_CONFIG[type];
  return (
    <div
      className={`relative w-10 h-10 rounded-md flex items-center justify-center border-2 border-transparent bg-gray-900 ${
        className ?? ""
      }`}
      aria-hidden
    >
      <div className={`flex items-center justify-center ${cfg.color}`}>
        <ResourceIcon type={type} className="h-5 w-5" />
      </div>
      {children}
    </div>
  );
}

export function Sidebar() {
  const { token, user, logout } = useAuth();
  const { data: labs, isLoading } = useHomeLabs(token);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ui.sidebarCollapsed") === "true";
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ui.sidebarCollapsed", collapsed ? "true" : "false");
    } catch (e) {
      // ignore
    }
  }, [collapsed]);

  const location = useLocation();
  const [helpExpanded, setHelpExpanded] = useState(() =>
    location.pathname.startsWith("/help")
  );

  useEffect(() => {
    if (location.pathname.startsWith("/help")) {
      setHelpExpanded(true);
    }
  }, [location.pathname]);

  return (
    <aside
      className={`${collapsed ? "w-[72px]" : "w-60"} shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 h-full transition-all duration-150 ease-out`}
    >
      {/* Logo + toggle */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-brand-500" />
          <span className={`text-lg font-bold text-white ${collapsed ? "sr-only" : ""}`}>Overwatch</span>
        </div>

        <div className="ml-auto">
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((s) => !s)}
            className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className={`h-5 w-5 transform transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <NavLink
          to="/overview"
          className={({ isActive }) =>
            `group relative flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-brand-900/50 text-brand-400" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          {!collapsed && <span>Overview</span>}
          {collapsed && (
            <div role="tooltip" className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus:block z-50">
              <div className="bg-gray-800 text-white text-sm px-3 py-1 rounded-md shadow">Overview</div>
            </div>
          )}
        </NavLink>

        {/* Resources section */}
        <div className="mt-4">
          <p className={`px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 ${collapsed ? "sr-only" : ""}`}>
            Resources
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
            </div>
          )}

          {labs?.map((lab) => {
            const type = (lab.resourceType as ResourceType) ?? "HOMELAB";
            const cfg = RESOURCE_TYPE_CONFIG[type];
            const labelsPreview = lab.labels && lab.labels.length ? lab.labels.slice(0, 2).join(", ") : "";
            return (
              <NavLink
                key={lab.id}
                to={`/labs/${lab.id}`}
                className={({ isActive }) =>
                  `group relative flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-brand-900/50 text-brand-400" : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`
                }
                tabIndex={0}
              >
                <span className={`flex items-center gap-2 min-w-0 ${collapsed ? "" : "truncate"}`}>
                  <IconBox type={type}>
                    {/* optional status dot could be added here */}
                  </IconBox>

                  {!collapsed && <span className="truncate">{lab.name}</span>}
                </span>

                {!collapsed && <ChevronRight className="h-3 w-3 shrink-0" />}

                {collapsed && (
                  <div role="tooltip" className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus:block z-50">
                    <div className="bg-gray-800 text-white text-sm px-3 py-2 rounded-md shadow max-w-xs">
                      <div className="font-medium">{lab.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{cfg.label}{labelsPreview ? ` • ${labelsPreview}` : ""}</div>
                    </div>
                  </div>
                )}

              </NavLink>
            );
          })}

          {!isLoading && labs?.length === 0 && (
            <p className={`px-3 py-2 text-xs text-gray-600 italic ${collapsed ? "sr-only" : ""}`}>No resources configured</p>
          )}
        </div>

        {/* Help expandable */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          {!collapsed ? (
            <>
              <button
                onClick={() => setHelpExpanded((s) => !s)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/help")
                    ? "text-brand-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <span className="flex items-center gap-3">
                  <HelpCircle className="h-4 w-4 shrink-0" />
                  <span>Help</span>
                </span>
                <ChevronRight
                  className={`h-3 w-3 transform transition-transform ${helpExpanded ? "rotate-90" : ""}`}
                />
              </button>
              {helpExpanded && (
                <div className="mt-1 ml-3 pl-3 border-l border-gray-800 flex flex-col gap-0.5">
                  {HELP_TOPICS.map(({ id, title, icon: Icon }) => (
                    <NavLink
                      key={id}
                      to={`/help/${id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "text-brand-400 bg-brand-900/40"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                        }`
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {title}
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          ) : (
            <NavLink
              to="/help/getting-started"
              className={({ isActive }) =>
                `group relative flex justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-900/50 text-brand-400" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <HelpCircle className="h-4 w-4" />
              <div role="tooltip" className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus:block z-50">
                <div className="bg-gray-800 text-white text-sm px-3 py-1 rounded-md shadow">Help</div>
              </div>
            </NavLink>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gray-800 flex items-center justify-center">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
              <path d="M6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
            </svg>
          </div>

          <div className={`${collapsed ? "sr-only" : "min-w-0"}`}>
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
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
