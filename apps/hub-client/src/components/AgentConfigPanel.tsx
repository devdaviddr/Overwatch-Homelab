import { useState, useEffect, useRef } from "react";
import { Copy, Check, Settings2, Wifi, WifiOff, TerminalSquare, AlertTriangle, Radio, Loader2, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth.tsx";
import { useUpdateHomeLab } from "../hooks/useHomeLabMutations.ts";
import { useAvailableAgents } from "../hooks/useAvailableAgents.ts";
import { apiFetch } from "../lib/api.ts";
import { useQueryClient } from "@tanstack/react-query";

const isMac = navigator.platform.startsWith("Mac") || /Mac OS/.test(navigator.userAgent);

interface HomeLab {
  id: string;
  name: string;
  agentHubUrl?: string | null;
  heartbeatIntervalMs: number;
  metricsIntervalMs: number;
}

interface Props {
  lab: HomeLab;
  connected: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function AgentConfigPanel({ lab, connected }: Props) {
  const { token } = useAuth();
  const updateLab = useUpdateHomeLab(token);
  const queryClient = useQueryClient();
  const { data: agents, isLoading: agentsLoading } = useAvailableAgents(token);

  const defaultHubUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
  const hubUrl = lab.agentHubUrl || defaultHubUrl;

  const [editing, setEditing] = useState(false);
  const [hubUrlInput, setHubUrlInput] = useState(lab.agentHubUrl || "");
  const [heartbeatInput, setHeartbeatInput] = useState(String(lab.heartbeatIntervalMs));
  const [metricsInput, setMetricsInput] = useState(String(lab.metricsIntervalMs));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<"native" | "docker">("native");
  const [assigningSocketId, setAssigningSocketId] = useState<string | null>(null);

  // Local agent launcher state
  const [canLaunch, setCanLaunch] = useState<boolean | null>(null);
  const [agentRunning, setAgentRunning] = useState<{ running: boolean; pid?: number } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchRunningStatus() {
    try {
      const { data } = await apiFetch<{ running: boolean; pid?: number }>(`/api/agent/${lab.id}/launch`, { token });
      setAgentRunning(data);
    } catch {
      // silently ignore — hub may not have this route yet
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: caps } = await apiFetch<{ canLaunch: boolean; reason?: string }>("/api/agent/capabilities", { token });
        if (cancelled) return;
        setCanLaunch(caps.canLaunch);
        if (caps.canLaunch) {
          await fetchRunningStatus();
          // Poll every 5 seconds
          pollRef.current = setInterval(fetchRunningStatus, 5000);
        }
      } catch {
        if (!cancelled) setCanLaunch(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  async function handleStart() {
    setLaunching(true);
    try {
      await apiFetch(`/api/agent/${lab.id}/launch`, {
        method: "POST",
        token,
        body: {
          hubUrl,
          heartbeatIntervalMs: lab.heartbeatIntervalMs,
          metricsIntervalMs: lab.metricsIntervalMs,
        },
      });
      await fetchRunningStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start agent");
    } finally {
      setLaunching(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await apiFetch(`/api/agent/${lab.id}/launch`, {
        method: "DELETE",
        token,
      });
      await fetchRunningStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stop agent");
    } finally {
      setStopping(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateLab.mutateAsync({
        id: lab.id,
        agentHubUrl: hubUrlInput || null,
        heartbeatIntervalMs: parseInt(heartbeatInput, 10),
        metricsIntervalMs: parseInt(metricsInput, 10),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function assignAgent(socketId: string) {
    setAssigningSocketId(socketId);
    try {
      await apiFetch(`/api/homelabs/${lab.id}/assign-agent`, {
        method: "POST",
        token,
        body: { socketId },
      });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign agent");
    } finally {
      setAssigningSocketId(null);
    }
  }

  const envBlock = [
    `LAB_ID=${lab.id}`,
    `HUB_URL=${hubUrl}`,
    `HEARTBEAT_INTERVAL_MS=${lab.heartbeatIntervalMs}`,
    `METRICS_INTERVAL_MS=${lab.metricsIntervalMs}`,
  ].join("\n");

  const nativeOneLiner = `LAB_ID=${lab.id} HUB_URL=${hubUrl} HEARTBEAT_INTERVAL_MS=${lab.heartbeatIntervalMs} METRICS_INTERVAL_MS=${lab.metricsIntervalMs} npx tsx apps/lab-agent/src/index.ts`;

  const dockerBlock = `# Linux hosts only — Docker on macOS reports VM specs, not real hardware
docker run -d --pid=host --privileged \\
  -v /proc:/host/proc:ro \\
  -v /sys:/host/sys:ro \\
  -e LAB_ID=${lab.id} \\
  -e HUB_URL=${hubUrl} \\
  -e HEARTBEAT_INTERVAL_MS=${lab.heartbeatIntervalMs} \\
  -e METRICS_INTERVAL_MS=${lab.metricsIntervalMs} \\
  overwatch/lab-agent:local`;

  return (
    <div className="space-y-4">
      {/* ── Local Agent Launcher (only when hub can launch) ── */}
      {canLaunch && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-medium text-white">Local Agent</h3>
            </div>

            <div className="flex items-center gap-2">
              {agentRunning?.running ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    Running{agentRunning.pid ? ` · PID ${agentRunning.pid}` : ""}
                  </span>
                  <button
                    onClick={handleStop}
                    disabled={stopping}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {stopping ? "Stopping…" : "Stop"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={launching || agentRunning === null}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {launching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {launching ? "Starting…" : isMac ? "Start on this Mac" : "Start on this machine"}
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      )}

      {/* ── Detected Agents ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="h-4 w-4 text-brand-400" />
          <h3 className="text-sm font-medium text-white">Detected Agents</h3>
          <span className="text-xs text-gray-600 ml-1">refreshes every 10s</span>
        </div>

        {agentsLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning…
          </div>
        )}

        {!agentsLoading && (!agents || agents.length === 0) && (
          <p className="text-sm text-gray-600 italic py-1">No agents connected to the hub.</p>
        )}

        {agents && agents.length > 0 && (
          <div className="space-y-2">
            {agents.map((agent) => {
              const isThis = agent.labId === lab.id;
              const isAssigning = assigningSocketId === agent.socketId;
              return (
                <div
                  key={agent.socketId}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                    isThis
                      ? "border-green-800/60 bg-green-950/20"
                      : "border-gray-700/60 bg-gray-800/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${isThis ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
                      />
                      <code className="text-xs font-mono text-gray-300 truncate">{agent.labId}</code>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5 ml-4">
                      v{agent.agentVersion} · last seen {new Date(agent.lastHeartbeat).toLocaleTimeString()}
                    </p>
                  </div>

                  {isThis ? (
                    <span className="text-xs text-green-400 font-medium shrink-0">Connected</span>
                  ) : (
                    <button
                      onClick={() => assignAgent(agent.socketId)}
                      disabled={isAssigning}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
                    >
                      {isAssigning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {isAssigning ? "Connecting…" : "Connect"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* ── Agent Configuration ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-400" />
            <h3 className="text-sm font-medium text-white">Agent Configuration</h3>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ml-1 ${
              connected
                ? "text-green-400 border-green-800 bg-green-950/40"
                : "text-gray-500 border-gray-700"
            }`}>
              {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {connected ? "Agent connected" : "No agent connected"}
            </span>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hub URL</label>
              <input
                type="text"
                value={hubUrlInput}
                onChange={(e) => setHubUrlInput(e.target.value)}
                placeholder={defaultHubUrl}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
              />
              <p className="text-xs text-gray-600 mt-1">Leave blank to use the default hub address.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Heartbeat interval (ms)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={heartbeatInput}
                  onChange={(e) => setHeartbeatInput(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Metrics interval (ms)</label>
                <input
                  type="number"
                  min={5000}
                  step={5000}
                  value={metricsInput}
                  onChange={(e) => setMetricsInput(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setError(null); }}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "LAB_ID", value: lab.id },
                { label: "HUB_URL", value: hubUrl },
                { label: "HEARTBEAT_INTERVAL_MS", value: String(lab.heartbeatIntervalMs) },
                { label: "METRICS_INTERVAL_MS", value: String(lab.metricsIntervalMs) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800/60 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-brand-300 font-mono truncate">{value}</code>
                    <CopyButton value={value} />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <TerminalSquare className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">.env file</span>
                <CopyButton value={envBlock} />
              </div>
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">
                {envBlock}
              </pre>
            </div>

            <div>
              <div className="flex items-center gap-0 mb-0 border border-gray-800 rounded-t-lg overflow-hidden">
                <button
                  onClick={() => setSnippetTab("native")}
                  className={`flex-1 text-xs px-3 py-1.5 transition-colors ${
                    snippetTab === "native"
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-300 bg-gray-900"
                  }`}
                >
                  Native (macOS / Linux)
                </button>
                <button
                  onClick={() => setSnippetTab("docker")}
                  className={`flex-1 text-xs px-3 py-1.5 transition-colors border-l border-gray-800 ${
                    snippetTab === "docker"
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-300 bg-gray-900"
                  }`}
                >
                  Docker (Linux only)
                </button>
              </div>

              {snippetTab === "native" ? (
                <div>
                  <div className="flex items-center justify-between bg-gray-950 border border-t-0 border-gray-800 px-3 py-1.5">
                    <span className="text-xs text-gray-500">Run agent natively — reports real host hardware</span>
                    <CopyButton value={nativeOneLiner} />
                  </div>
                  <pre className="bg-gray-950 border border-t-0 border-gray-800 rounded-b-lg px-3 pb-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">
                    {`# From the repo root (no build needed):\n${nativeOneLiner}`}
                  </pre>
                </div>
              ) : (
                <div>
                  {isMac && (
                    <div className="flex items-center gap-1.5 bg-amber-950/30 border border-t-0 border-amber-900/50 px-3 py-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-400">
                        Docker on macOS runs in a Linux VM — metrics will reflect VM specs, not real host hardware. Use native mode on macOS.
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end bg-gray-950 border border-t-0 border-gray-800 px-3 py-1">
                    <CopyButton value={dockerBlock} />
                  </div>
                  <pre className="bg-gray-950 border border-t-0 border-gray-800 rounded-b-lg px-3 pb-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">
                    {dockerBlock}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
