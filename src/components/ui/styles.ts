/**
 * Shared class recipes for the design system. Use these (or the components
 * built on them) instead of one-off styling on pages.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-[1.15em] [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-maize text-navy hover:bg-maize-hover shadow-[0_10px_28px_-14px_rgb(240_196_19/0.65)]",
  secondary:
    "border border-line bg-white/[0.03] text-fg hover:border-fg-3/70 hover:bg-white/[0.07]",
  ghost: "text-fg-2 hover:bg-white/[0.06] hover:text-fg",
  danger: "border border-bad/50 bg-bad/10 text-bad hover:bg-bad/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 text-sm",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-6 text-base",
};

export function button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`;
}

/** Card surface: layered navy with a soft top light. */
export const card =
  "rounded-2xl border border-line/70 bg-linear-to-b from-surface to-[#0d2741] shadow-card";

/** Interactive card: lifts slightly on hover/focus. */
export const cardInteractive =
  `${card} transition-[transform,box-shadow,border-color] duration-200 ease-out ` +
  "hover:-translate-y-0.5 hover:border-fg-3/50 hover:shadow-lift focus-visible:-translate-y-0.5";

/** Page container widths. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
