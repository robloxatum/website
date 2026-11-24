import type { ReactNode } from "react";

const tones = {
  info: "bg-sky",
  success: "bg-grass text-white",
  warning: "bg-maize",
  error: "bg-brick text-white",
} as const;

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof tones;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`block-card p-4 ${tones[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function PageTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="mb-6">
      {kicker && <p className="font-display text-sm uppercase text-blue/60">{kicker}</p>}
      <h1 className="text-3xl leading-tight sm:text-4xl">{children}</h1>
    </div>
  );
}

export function SkeletonBlock({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse border-4 border-blue/20 bg-white/60 ${className}`} />;
}
