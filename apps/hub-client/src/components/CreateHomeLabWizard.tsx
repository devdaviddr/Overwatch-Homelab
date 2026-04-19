import { useState } from "react";
import { X, Server, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useCreateHomeLab } from "../hooks/useHomeLabMutations.ts";

interface Props {
  onClose: () => void;
  onCreated: (labId: string) => void;
}

const STEPS = ["Basic Info", "Review"] as const;

export function CreateHomeLabWizard({ onClose, onCreated }: Props) {
  const { token } = useAuth();
  const createLab = useCreateHomeLab(token);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function canAdvance() {
    return step === 0 ? name.trim().length > 0 : true;
  }

  function next() { setError(null); setStep((s) => s + 1); }
  function back() { setError(null); setStep((s) => s - 1); }

  async function handleCreate() {
    setError(null);
    try {
      const lab = await createLab.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(lab.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">New HomeLab</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-brand-500" : "bg-gray-800"}`} />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 min-h-[180px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Lab Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Home Server Rack"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description <span className="text-gray-600 text-xs">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this homelab is for…"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Server className="h-4 w-4 text-brand-400" />
                  {name}
                </div>
                {description && (
                  <p className="text-sm text-gray-400 ml-6">{description}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                After creating the homelab, you'll be taken to its configuration page where you can set up and connect the lab-agent.
              </p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <button
            onClick={step === 0 ? onClose : back}
            disabled={createLab.isPending}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={createLab.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {createLab.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {createLab.isPending ? "Creating…" : "Create HomeLab"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
