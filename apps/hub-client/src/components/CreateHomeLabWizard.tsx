import { useState } from "react";
import { X, Server, HardDrive, Plus, Trash2, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useCreateHomeLab, useCreateStoragePool } from "../hooks/useHomeLabMutations.ts";

interface StoragePoolDraft {
  id: string;
  name: string;
  sizeValue: string;
  sizeUnit: "GB" | "TB";
}

interface Props {
  onClose: () => void;
  onCreated: (labId: string) => void;
}

const STEPS = ["Basic Info", "Storage Pools", "Review"] as const;

export function CreateHomeLabWizard({ onClose, onCreated }: Props) {
  const { token } = useAuth();
  const createLab = useCreateHomeLab(token);
  const createPool = useCreateStoragePool(token);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pools, setPools] = useState<StoragePoolDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── storage pool helpers ──────────────────────────────────────────────────
  function addPool() {
    setPools((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", sizeValue: "", sizeUnit: "TB" },
    ]);
  }

  function updatePool(id: string, patch: Partial<StoragePoolDraft>) {
    setPools((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePool(id: string) {
    setPools((prev) => prev.filter((p) => p.id !== id));
  }

  function poolsValid() {
    return pools.every(
      (p) => p.name.trim() && p.sizeValue && Number(p.sizeValue) > 0
    );
  }

  function toBytes(value: string, unit: "GB" | "TB") {
    const n = parseFloat(value);
    return unit === "TB" ? Math.round(n * 1e12) : Math.round(n * 1e9);
  }

  // ── navigation ────────────────────────────────────────────────────────────
  function canAdvance() {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return poolsValid() || pools.length === 0;
    return true;
  }

  function next() {
    setError(null);
    setStep((s) => s + 1);
  }
  function back() {
    setError(null);
    setStep((s) => s - 1);
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    setError(null);
    try {
      const lab = await createLab.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      for (const p of pools) {
        await createPool.mutateAsync({
          homeLabId: lab.id,
          name: p.name.trim(),
          totalBytes: toBytes(p.sizeValue, p.sizeUnit),
        });
      }

      onCreated(lab.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isSubmitting = createLab.isPending || createPool.isPending;

  // ── render ────────────────────────────────────────────────────────────────
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
            <div key={label} className="flex-1 flex flex-col gap-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= step ? "bg-brand-500" : "bg-gray-800"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 min-h-[220px]">
          {/* Step 0 – Basic Info */}
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

          {/* Step 1 – Storage Pools */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Add storage pools to track disk usage. You can skip this and add them later.
              </p>

              {pools.map((pool) => (
                <div
                  key={pool.id}
                  className="flex gap-2 items-start bg-gray-800/60 border border-gray-700 rounded-lg p-3"
                >
                  <HardDrive className="h-4 w-4 text-gray-500 mt-2.5 shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={pool.name}
                      onChange={(e) => updatePool(pool.id, { name: e.target.value })}
                      placeholder="Pool name"
                      className="col-span-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={pool.sizeValue}
                      onChange={(e) => updatePool(pool.id, { sizeValue: e.target.value })}
                      placeholder="Size"
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <select
                      value={pool.sizeUnit}
                      onChange={(e) =>
                        updatePool(pool.id, { sizeUnit: e.target.value as "GB" | "TB" })
                      }
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                    </select>
                  </div>
                  <button
                    onClick={() => removePool(pool.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors mt-0.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addPool}
                className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add storage pool
              </button>
            </div>
          )}

          {/* Step 2 – Review */}
          {step === 2 && (
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

              {pools.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                    Storage Pools
                  </p>
                  <div className="space-y-2">
                    {pools.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-2.5 text-sm"
                      >
                        <span className="flex items-center gap-2 text-white">
                          <HardDrive className="h-3.5 w-3.5 text-gray-500" />
                          {p.name}
                        </span>
                        <span className="text-gray-400">
                          {p.sizeValue} {p.sizeUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pools.length === 0 && (
                <p className="text-sm text-gray-500 italic">No storage pools — you can add them later.</p>
              )}

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <button
            onClick={step === 0 ? onClose : back}
            disabled={isSubmitting}
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isSubmitting ? "Creating…" : "Create HomeLab"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
