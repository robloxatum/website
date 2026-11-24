import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  info: { icon: Info, className: "border-line bg-elevated/60 text-fg", iconClass: "text-fg-2" },
  success: { icon: CircleCheck, className: "border-ok/40 bg-ok/10 text-fg", iconClass: "text-ok" },
  warning: { icon: TriangleAlert, className: "border-maize/40 bg-maize/10 text-fg", iconClass: "text-maize" },
  error: { icon: CircleAlert, className: "border-bad/40 bg-bad/10 text-fg", iconClass: "text-bad" },
} as const;

/** Inline message box (errors, confirmations). */
export function Alert({ tone = "info", title, children }: { tone?: keyof typeof tones; title: string; children?: ReactNode }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-4 ${t.className}`}>
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${t.iconClass}`} />
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-fg-2">{children}</div>}
      </div>
    </div>
  );
}
