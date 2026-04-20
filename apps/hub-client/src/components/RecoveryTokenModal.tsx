import { useState } from "react";
import { Copy, Check, ShieldAlert, AlertTriangle } from "lucide-react";

interface Props {
  token: string;
  onClose: () => void;
  // Context message for the reason we're showing it.
  context: "signup" | "reset" | "regenerate";
}

const CONTEXT_COPY: Record<Props["context"], { title: string; body: string; cta: string }> = {
  signup: {
    title: "Save your recovery token",
    body:
      "This one-time token lets you reset your password if you forget it. We only store a hash — if you lose this, you'll need to create a new account.",
    cta: "I've saved it, continue",
  },
  reset: {
    title: "Password reset complete",
    body:
      "Your password has been updated. Your previous recovery token has been invalidated — save this new one somewhere safe.",
    cta: "I've saved it, continue",
  },
  regenerate: {
    title: "New recovery token generated",
    body:
      "Your previous recovery token is now invalid. Save this one somewhere safe — we won't show it again.",
    cta: "Done",
  },
};

export function RecoveryTokenModal({ token, onClose, context }: Props) {
  const [copied, setCopied] = useState(false);
  const { title, body, cta } = CONTEXT_COPY[context];

  function copy() {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-amber-900/60 rounded-2xl shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">{body}</p>

          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-900/60 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] font-mono text-amber-300 leading-relaxed">
              This token is shown once. Treat it like a password — store it in your password manager.
            </p>
          </div>

          <div className="relative">
            <div className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 pr-14 font-mono text-[11px] text-gray-100 break-all">
              {token}
            </div>
            <button
              onClick={copy}
              aria-label="Copy recovery token"
              className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-md transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-100 bg-brand-600 hover:bg-brand-500 border border-brand-700 rounded-lg transition-colors"
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
