import { useState, KeyboardEvent } from "react";
import { X, Server, Database, Monitor, ChevronRight, ChevronLeft, Check, Loader2, Tag } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useCreateHomeLab } from "../hooks/useHomeLabMutations.ts";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceTypes.ts";
import { apiFetch } from "../lib/api.ts";
import type { ResourceType } from "@overwatch/shared-types";

interface Props {
  onClose: () => void;
  onCreated: (labId: string) => void;
}

const STEPS = ["Basic Info", "Type & Labels", "Agent Configuration", "Review"] as const;

const TYPE_OPTIONS: ResourceType[] = ["HOMELAB", "SERVER", "PC"];

type Platform = "mac" | "linux" | "windows";

const isMac = navigator.platform.startsWith("Mac") || /Mac OS/.test(navigator.userAgent);

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
        <span
          key={t}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-brand-900/50 text-brand-300 border border-brand-700/60 rounded"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-brand-500 hover:text-white ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Add label… (Enter or comma to add)" : ""}
        className="flex-1 min-w-[120px] bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none"
      />
    </div>
  );
}

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "mac", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "windows", label: "Windows" },
];

const detectedPlatform: Platform = isMac ? "mac" : "linux";

export function CreateHomeLabWizard({ onClose, onCreated }: Props) {
  const { token } = useAuth();
  const createLab = useCreateHomeLab(token);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("HOMELAB");
  const [labels, setLabels] = useState<string[]>([]);

  // Agent configuration fields
  const [platform, setPlatform] = useState<Platform>(detectedPlatform);
  const [agentHubUrl, setAgentHubUrl] = useState<string>("http://localhost:3002");
  const [heartbeatIntervalMs, setHeartbeatIntervalMs] = useState<number>(15000);
  const [metricsIntervalMs, setMetricsIntervalMs] = useState<number>(60000);
  const [runInDocker, setRunInDocker] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<"idle" | "launching" | "launched" | "failed">("idle");

  function canAdvance() {
    if (step === 0) return name.trim().length > 0;
    return true;
  }

  function next() { setError(null); setStep((s) => s + 1); }
  function back() { setError(null); setStep((s) => s - 1); }

  async function handleCreate() {
    setError(null);
    setLaunchState("idle");
    try {
      const lab = await createLab.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        resourceType,
        labels,
        agentHubUrl: agentHubUrl || undefined,
        heartbeatIntervalMs,
        metricsIntervalMs,
      });

      // Auto-launch agent on macOS if hub supports it
      if (platform === "mac") {
        setLaunchState("launching");
        try {
          const capRes = await apiFetch<{ canLaunch: boolean; reason?: string }>(
            "/api/agent/capabilities",
            { token }
          );
          if (capRes.data.canLaunch) {
            const launchRes = await apiFetch<{ launched: boolean; pid?: number; reason?: string }>(
              `/api/agent/${lab.id}/launch`,
              {
                method: "POST",
                token,
                body: {
                  hubUrl: agentHubUrl,
                  heartbeatIntervalMs,
                  metricsIntervalMs,
                },
              }
            );
            setLaunchState(launchRes.data.launched ? "launched" : "failed");
          } else {
            // Hub is in Docker mode — skip launch silently
            setLaunchState("failed");
          }
        } catch {
          // Launch errors are non-fatal — proceed regardless
          setLaunchState("failed");
        }
      }

      onCreated(lab.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const cfg = RESOURCE_TYPE_CONFIG[resourceType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">New Resource</h2>
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
        <div className="px-6 py-5 flex-1 min-h-[220px]">
          {/* Step 0: Basic info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canAdvance() && next()}
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
                  placeholder="What is this resource for?"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 1: Type + labels */}
          {step === 1 && (
            <div className="space-y-5">
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
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
                          selected
                            ? `${c.bgColor} ${c.borderColor} ${c.color}`
                            : "bg-gray-800/40 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                        }`}
                      >
                        <ResourceTypeIcon type={type} className={`h-5 w-5 ${selected ? c.color : ""}`} />
                        <span className="text-xs font-medium">{c.label}</span>
                        <span className="text-[10px] leading-tight opacity-70">{c.description}</span>
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
            </div>
          )}

          {/* Step 2: Agent Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Platform selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
                <div className="flex gap-2">
                  {PLATFORM_OPTIONS.map(({ value, label }) => {
                    const selected = platform === value;
                    const isDetected = value === detectedPlatform;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPlatform(value)}
                        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          selected
                            ? "bg-brand-600 border-brand-500 text-white"
                            : "bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                        }`}
                      >
                        {label}
                        {isDetected && (
                          <span className="text-[10px] text-gray-400 font-normal leading-none">
                            detected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hub URL</label>
                  <input
                    type="url"
                    value={agentHubUrl}
                    onChange={(e) => setAgentHubUrl(e.target.value)}
                    placeholder="http://localhost:3002"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Heartbeat interval (ms)</label>
                    <input
                      type="number"
                      min={1000}
                      value={heartbeatIntervalMs}
                      onChange={(e) => setHeartbeatIntervalMs(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Metrics interval (ms)</label>
                    <input
                      type="number"
                      min={5000}
                      value={metricsIntervalMs}
                      onChange={(e) => setMetricsIntervalMs(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Docker option — hidden on macOS, shown on Linux/Windows */}
                {platform !== "mac" ? (
                  <div className="flex items-center gap-3">
                    <input
                      id="runInDocker"
                      type="checkbox"
                      checked={runInDocker}
                      onChange={(e) => setRunInDocker(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="runInDocker" className="text-sm text-gray-300">Run in Docker</label>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-950/40 border border-amber-800/50 rounded-lg">
                    <span className="text-amber-400 text-sm leading-none mt-0.5">⚠</span>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Docker on macOS reports VM specs (4 CPU / ~7 GB RAM), not real hardware. Native mode is required.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">.env preview</label>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 font-mono text-sm text-green-300 whitespace-pre-wrap">
{`LAB_ID=<LAB_ID>\nHUB_URL=${agentHubUrl}\nHEARTBEAT_INTERVAL_MS=${heartbeatIntervalMs}\nMETRICS_INTERVAL_MS=${metricsIntervalMs}`}
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard &&
                      navigator.clipboard.writeText(`LAB_ID=<LAB_ID>\nHUB_URL=${agentHubUrl}\nHEARTBEAT_INTERVAL_MS=${heartbeatIntervalMs}\nMETRICS_INTERVAL_MS=${metricsIntervalMs}`)
                    }
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-sm rounded-md text-white hover:bg-gray-700"
                  >
                    Copy .env
                  </button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className={`${cfg.bgColor} border ${cfg.borderColor} rounded-xl p-4 space-y-2`}>
                <div className={`flex items-center gap-2 font-semibold ${cfg.color}`}>
                  <ResourceTypeIcon type={resourceType} className="h-4 w-4" />
                  <span className="text-white">{name}</span>
                  <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                {description && <p className="text-sm text-gray-400 ml-6">{description}</p>}
                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-6">
                    {labels.map((l) => (
                      <span key={l} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                <div className="ml-6 mt-2 text-sm text-gray-300 space-y-1">
                  <div>
                    <span className="text-gray-400">Platform:</span>{" "}
                    <span className="text-white capitalize">{platform === "mac" ? "macOS" : platform}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Hub URL:</span> <span className="text-white">{agentHubUrl}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Heartbeat:</span> <span className="text-white">{heartbeatIntervalMs} ms</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Metrics interval:</span> <span className="text-white">{metricsIntervalMs} ms</span>
                  </div>
                </div>
              </div>

              {/* macOS auto-launch status */}
              {platform === "mac" && launchState === "launching" && (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                  <span>Starting agent on this Mac…</span>
                </div>
              )}
              {platform === "mac" && launchState === "launched" && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Check className="h-4 w-4" />
                  <span>Agent started — will connect shortly</span>
                </div>
              )}

              <p className="text-xs text-gray-500">
                {platform === "mac"
                  ? "After creating, the agent will be started automatically on this Mac."
                  : "After creating, you'll be taken to the configuration page to connect a lab-agent."}
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
              disabled={createLab.isPending || launchState === "launching"}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {createLab.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : launchState === "launching" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {createLab.isPending
                ? "Creating…"
                : launchState === "launching"
                ? "Starting agent…"
                : "Create Resource"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
