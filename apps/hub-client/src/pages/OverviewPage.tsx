import { Server, HardDrive, Activity } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";

export function OverviewPage() {
  const { token } = useAuth();
  const { data: labs, isLoading } = useHomeLabs(token);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Overview</h1>

      {isLoading && (
        <div className="text-gray-400 text-sm">Loading homelabs…</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {labs?.map((lab) => (
          <div
            key={lab.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-900/40 rounded-lg">
                <Server className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{lab.name}</h2>
                {lab.description && (
                  <p className="text-xs text-gray-500">{lab.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {(lab as { storagePools?: unknown[] }).storagePools?.length ?? 0} storage pool(s)
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                Configured
              </span>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && labs?.length === 0 && (
        <div className="mt-8 text-center text-gray-500">
          <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No homelabs yet. Create one via the API to get started.</p>
        </div>
      )}
    </div>
  );
}
