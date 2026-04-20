import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Server, Database, Monitor, Loader2, Pencil, Trash2, ActivitySquare, WifiOff, Settings, BarChart2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLab } from "../hooks/useHomeLabs.ts";
import { useLabMetrics } from "../hooks/useLabMetrics.ts";
import { EditHomeLabModal } from "../components/EditHomeLabModal.tsx";
import { DeleteHomeLabDialog } from "../components/DeleteHomeLabDialog.tsx";
import { AgentConfigPanel } from "../components/AgentConfigPanel.tsx";
import { MetricsDashboard } from "../components/MetricsDashboard.tsx";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceTypes.ts";
import type { ResourceType } from "@overwatch/shared-types";

type Tab = "monitor" | "configuration";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "monitor", label: "Monitor", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: "configuration", label: "Configuration", icon: <Settings className="h-3.5 w-3.5" /> },
];

function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const { iconName } = RESOURCE_TYPE_CONFIG[type];
  if (iconName === "database") return <Database className={className} />;
  if (iconName === "monitor") return <Monitor className={className} />;
  return <Server className={className} />;
}

export function HomeLabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data: lab, isLoading, error } = useHomeLab(token, labId);
  const { metrics, connected, lastUpdated, history } = useLabMetrics(labId);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("monitor");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div className="text-red-400 text-sm">
        Failed to load homelab: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const labData = lab as unknown as {
    id: string; name: string; description?: string | null;
    resourceType?: ResourceType; labels?: string[];
    agentHubUrl?: string | null; heartbeatIntervalMs: number; metricsIntervalMs: number;
    createdAt: string; updatedAt: string;
  };

  const type: ResourceType = labData.resourceType ?? "HOMELAB";
  const cfg = RESOURCE_TYPE_CONFIG[type];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${cfg.bgColor} border-2 ${cfg.borderColor}`}>
            <ResourceIcon type={type} className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{labData.name}</h1>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                {cfg.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                  connected
                    ? "text-green-400 border-green-900/60 bg-green-950/30"
                    : "text-gray-600 border-gray-800 bg-gray-900"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-600"}`}
                  style={connected ? { boxShadow: "0 0 5px #22c55e" } : {}}
                />
                {connected ? "AGENT ONLINE" : "AGENT OFFLINE"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {labData.description && (
                <p className="text-sm text-gray-500">{labData.description}</p>
              )}
              {Array.isArray(labData.labels) && labData.labels.map((l: string) => (
                <span key={l} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-700/60 rounded-lg transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-400 bg-gray-900 hover:bg-red-950/40 border border-gray-700/60 hover:border-red-900 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-800/60 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Monitor tab ── */}
      {activeTab === "monitor" && (
        <div>
          {metrics ? (
            <MetricsDashboard
              metrics={metrics}
              lastUpdated={lastUpdated}
              connected={connected}
              history={history}
            />
          ) : (
            <div className="bg-[#060d1a] border border-gray-800/60 rounded-xl p-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {connected ? (
                  <>
                    <ActivitySquare className="h-5 w-5 text-gray-600 animate-pulse" />
                    <span className="text-gray-400 text-sm font-mono">
                      Waiting for first metrics report…
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-gray-700" />
                    <span className="text-gray-600 text-sm font-mono">No agent connected</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-700 font-mono mt-1">
                Metrics are pushed every {labData.metricsIntervalMs / 1000}s by the lab-agent.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Configuration tab ── */}
      {activeTab === "configuration" && (
        <AgentConfigPanel lab={labData} connected={connected} />
      )}

      {showEdit && (
        <EditHomeLabModal
          lab={{ ...labData, description: labData.description ?? null }}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
        />
      )}

      {showDelete && (
        <DeleteHomeLabDialog
          lab={lab}
          onClose={() => setShowDelete(false)}
          onDeleted={() => navigate("/overview")}
        />
      )}
    </div>
  );
}
