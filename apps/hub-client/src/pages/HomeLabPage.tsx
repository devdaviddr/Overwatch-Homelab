import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HardDrive, Server, Loader2, Pencil, Trash2, ActivitySquare, WifiOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLab } from "../hooks/useHomeLabs.ts";
import { useLabMetrics } from "../hooks/useLabMetrics.ts";
import { EditHomeLabModal } from "../components/EditHomeLabModal.tsx";
import { DeleteHomeLabDialog } from "../components/DeleteHomeLabDialog.tsx";
import { MetricsDashboard } from "../components/MetricsDashboard.tsx";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  const pools = (lab as unknown as { storagePools: { id: string; name: string; totalBytes: number; usedBytes: number }[] }).storagePools ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-900/40 rounded-lg">
            <Server className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{lab.name}</h1>
            {lab.description && (
              <p className="text-sm text-gray-400">{lab.description}</p>
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
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Storage Pools</p>
          <p className="text-2xl font-bold text-white">{pools.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Capacity</p>
          <p className="text-2xl font-bold text-white">
            {formatBytes(pools.reduce((s, p) => s + p.totalBytes, 0))}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Used</p>
          <p className="text-2xl font-bold text-white">
            {formatBytes(pools.reduce((s, p) => s + p.usedBytes, 0))}
          </p>
        </div>
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
              Metrics are pushed every 60 s by the lab-agent running on the monitored machine.
            </p>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-200 mb-3">Storage Pools</h2>
      {pools.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No storage pools configured for this homelab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool) => {
            const usedPct = pool.totalBytes > 0
              ? Math.round((pool.usedBytes / pool.totalBytes) * 100)
              : 0;
            const barColor = usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-yellow-500" : "bg-brand-500";

            return (
              <div key={pool.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="h-4 w-4 text-brand-400" />
                  <span className="font-medium text-white">{pool.name}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatBytes(pool.usedBytes)} used</span>
                  <span>{formatBytes(pool.totalBytes)} total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
