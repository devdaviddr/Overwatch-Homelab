import { useParams } from "react-router-dom";
import { HardDrive, Server, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLab } from "../hooks/useHomeLabs.ts";

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
  const { data: lab, isLoading, error } = useHomeLab(token, labId);

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
      <div className="flex items-center gap-3 mb-6">
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

            return (
              <div
                key={pool.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="h-4 w-4 text-brand-400" />
                  <span className="font-medium text-white">{pool.name}</span>
                </div>

                {/* Usage bar */}
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
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
    </div>
  );
}
