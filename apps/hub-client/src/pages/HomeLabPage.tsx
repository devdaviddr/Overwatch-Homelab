import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Server, Loader2, Pencil, Trash2, ActivitySquare, WifiOff, Calendar, Clock } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLab } from "../hooks/useHomeLabs.ts";
import { useLabMetrics } from "../hooks/useLabMetrics.ts";
import { EditHomeLabModal } from "../components/EditHomeLabModal.tsx";
import { DeleteHomeLabDialog } from "../components/DeleteHomeLabDialog.tsx";
import { AgentConfigPanel } from "../components/AgentConfigPanel.tsx";
import { MetricsDashboard } from "../components/MetricsDashboard.tsx";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HomeLabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data: lab, isLoading, error } = useHomeLab(token, labId);
  const { metrics, connected, lastUpdated } = useLabMetrics(labId);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

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
    agentHubUrl?: string | null; heartbeatIntervalMs: number; metricsIntervalMs: number;
    createdAt: string; updatedAt: string;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-900/40 rounded-lg">
            <Server className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{labData.name}</h1>
            {labData.description && (
              <p className="text-sm text-gray-400">{labData.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-gray-800 hover:bg-red-950/40 border border-gray-700 hover:border-red-800 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Agent Status</p>
          <p className={`text-sm font-semibold ${connected ? "text-green-400" : "text-gray-500"}`}>
            {connected ? "● Connected" : "○ Disconnected"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-2">
          <Calendar className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Created</p>
            <p className="text-sm font-medium text-white">{formatDate(labData.createdAt)}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-2">
          <Clock className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Metrics Interval</p>
            <p className="text-sm font-medium text-white">{labData.metricsIntervalMs / 1000}s</p>
          </div>
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="mb-8">
        <AgentConfigPanel lab={labData} connected={connected} />
      </div>

      {/* Live Metrics */}
      <div className="mb-8">
        {metrics ? (
          <MetricsDashboard metrics={metrics} lastUpdated={lastUpdated} connected={connected} />
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ActivitySquare className="h-5 w-5 text-gray-600" />
              {connected ? (
                <span className="text-gray-400 text-sm">Waiting for first metrics report from agent…</span>
              ) : (
                <span className="text-gray-500 text-sm flex items-center gap-1">
                  <WifiOff className="h-4 w-4" /> No agent connected for this lab
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600">
              Metrics are pushed every {labData.metricsIntervalMs / 1000}s by the lab-agent running on the monitored machine.
            </p>
          </div>
        )}
      </div>

      {showEdit && (
        <EditHomeLabModal
          lab={lab}
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
