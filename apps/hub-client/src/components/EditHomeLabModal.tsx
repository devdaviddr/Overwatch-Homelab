import { useState, KeyboardEvent } from "react";
import { X, Save, Loader2, Server, Database, Monitor, Tag } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useUpdateHomeLab } from "../hooks/useHomeLabMutations.ts";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceTypes.ts";
import type { ResourceType } from "@overwatch/shared-types";

interface Props {
  lab: {
    id: string;
    name: string;
    description: string | null;
    resourceType?: ResourceType;
    labels?: string[];
  };
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTIONS: ResourceType[] = ["HOMELAB", "SERVER", "PC"];

function ResourceTypeIcon({ type, className }: { type: ResourceType; className?: string }) {
  const { iconName } = RESOURCE_TYPE_CONFIG[type];
  if (iconName === "database") return <Database className={className} />;
  if (iconName === "monitor") return <Monitor className={className} />;
  return <Server className={className} />;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, "").trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg min-h-[40px] focus-within:ring-2 focus-within:ring-brand-500">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-brand-900/50 text-brand-300 border border-brand-700/60 rounded">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-brand-500 hover:text-white ml-0.5">×</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Add label… (Enter or comma)" : ""}
        className="flex-1 min-w-[120px] bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none"
      />
    </div>
  );
}

export function EditHomeLabModal({ lab, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const update = useUpdateHomeLab(token);

  const [name, setName] = useState(lab.name);
  const [description, setDescription] = useState(lab.description ?? "");
  const [resourceType, setResourceType] = useState<ResourceType>(lab.resourceType ?? "HOMELAB");
  const [labels, setLabels] = useState<string[]>(lab.labels ?? []);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: lab.id,
        name: name.trim(),
        description: description.trim() || null,
        resourceType,
        labels,
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
          <h2 className="text-lg font-bold text-white">Edit Resource</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resource Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((type) => {
                const c = RESOURCE_TYPE_CONFIG[type];
                const selected = resourceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setResourceType(type)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                      selected
                        ? `${c.bgColor} ${c.borderColor} ${c.color}`
                        : "bg-gray-800/40 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    <ResourceTypeIcon type={type} className={`h-4 w-4 ${selected ? c.color : ""}`} />
                    <span className="text-xs font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-gray-500" />
              Labels <span className="text-gray-600 text-xs">(optional)</span>
            </label>
            <TagInput tags={labels} onChange={setLabels} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} disabled={update.isPending} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || update.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
