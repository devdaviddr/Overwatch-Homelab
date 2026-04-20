import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Database, Monitor, Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";
import { CreateHomeLabWizard } from "../components/CreateHomeLabWizard.tsx";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceTypes.ts";
import type { ResourceType } from "@overwatch/shared-types";

function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const { iconName } = RESOURCE_TYPE_CONFIG[type];
  if (iconName === "database") return <Database className={className} />;
  if (iconName === "monitor") return <Monitor className={className} />;
  return <Server className={className} />;
}

export function OverviewPage() {
  const { token } = useAuth();
  const { data: labs, isLoading } = useHomeLabs(token);
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);

  function handleCreated(labId: string) {
    setShowWizard(false);
    navigate(`/labs/${labId}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Resources</h1>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Resource
        </button>
      </div>

      {isLoading && (
        <div className="text-gray-400 text-sm">Loading resources…</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {labs?.map((lab) => {
          const type = (lab.resourceType as ResourceType) ?? "HOMELAB";
          const cfg = RESOURCE_TYPE_CONFIG[type];
          return (
            <button
              key={lab.id}
              onClick={() => navigate(`/labs/${lab.id}`)}
              className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-brand-700 hover:bg-gray-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${cfg.bgColor} border-2 border-transparent`}>
                  <ResourceIcon type={type} className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-white">{lab.name}</h2>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor} font-mono`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {lab.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{lab.description}</p>
                    )}
                    {Array.isArray(lab.labels) && lab.labels.map((l: string) => (
                      <span key={l} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!isLoading && labs?.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center text-gray-500">
          <Server className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-lg font-medium text-gray-400 mb-1">No resources yet</p>
          <p className="text-sm mb-5">Add your first PC, server, or homelab to get started.</p>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add your first resource
          </button>
        </div>
      )}

      {showWizard && (
        <CreateHomeLabWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
