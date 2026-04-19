import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Activity, Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useHomeLabs } from "../hooks/useHomeLabs.ts";
import { CreateHomeLabWizard } from "../components/CreateHomeLabWizard.tsx";

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
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New HomeLab
        </button>
      </div>

      {isLoading && (
        <div className="text-gray-400 text-sm">Loading homelabs…</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {labs?.map((lab) => (
          <button
            key={lab.id}
            onClick={() => navigate(`/labs/${lab.id}`)}
            className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-brand-700 hover:bg-gray-800/60 transition-colors cursor-pointer"
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
                <Activity className="h-3.5 w-3.5" />
                Configured
              </span>
            </div>
          </button>
        ))}
      </div>

      {!isLoading && labs?.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center text-gray-500">
          <Server className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-lg font-medium text-gray-400 mb-1">No homelabs yet</p>
          <p className="text-sm mb-5">Get started by creating your first homelab.</p>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first HomeLab
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
