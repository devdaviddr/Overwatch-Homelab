import { useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useDeleteHomeLab } from "../hooks/useHomeLabMutations.ts";

interface Props {
  lab: { id: string; name: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteHomeLabDialog({ lab, onClose, onDeleted }: Props) {
  const { token } = useAuth();
  const del = useDeleteHomeLab(token);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await del.mutateAsync(lab.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Delete HomeLab</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">"{lab.name}"</span>?
          </p>
          <p className="text-sm text-gray-500">
            This will permanently remove the homelab and all its storage pools. This action cannot be undone.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            disabled={del.isPending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={del.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {del.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {del.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
