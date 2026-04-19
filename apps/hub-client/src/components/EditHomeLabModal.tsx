import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useUpdateHomeLab } from "../hooks/useHomeLabMutations.ts";

interface Props {
  lab: { id: string; name: string; description: string | null };
  onClose: () => void;
  onSaved: () => void;
}

export function EditHomeLabModal({ lab, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const update = useUpdateHomeLab(token);

  const [name, setName] = useState(lab.name);
  const [description, setDescription] = useState(lab.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: lab.id,
        name: name.trim(),
        description: description.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Edit HomeLab</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Lab Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            disabled={update.isPending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || update.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
