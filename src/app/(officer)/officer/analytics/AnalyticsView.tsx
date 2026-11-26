import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe,
  PieChart,
  Repeat,
  ScanLine,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EventCover } from "@/components/art/Art";
import { EmptyState } from "@/components/ui/Blocks";
import { button, card } from "@/components/ui/styles";
import {
  ANALYTICS_TIME_ZONE,
  TIMING_BUCKETS,
  formatChange,
  formatPercent,
  growthWithTotals,
  monthLabel,
  showUpRate,
  summarize,
  timingSummary,
  type AnalyticsData,
  type AnalyticsEvent,
  type RangeBounds,
} from "@/lib/analytics";
import { categoryInfo } from "@/lib/categories";
import { axisTicks, labelIndexes, niceMax, smoothPath } from "@/lib/chart";
import { withCovers } from "@/lib/event-covers";
import { RangeMenu, type RangeOption } from "./RangeMenu";

/** Where page views and flyer scans live (Vercel Web Analytics). */
const VERCEL_ANALYTICS_URL = "https://vercel.com/personal-3600/robloxatum/analytics";

/** One distinct color per category; every chart also labels them in text. */
const CATEGORY_COLORS: Record<string, string> = {
  game_night: "#f0c413",
  workshop: "#5ab0f0",
  game_jam: "#f08a5d",
  social: "#34d399",
  meeting: "#9fb3c8",
  partner: "#e879a6",
};

/** Stat card tints. Full class names, so Tailwind sees them. */
const TINTS = {
  sky: { card: "from-[#5ab0f0]/22 border-[#5ab0f0]/30", icon: "bg-[#5ab0f0]/18 text-[#8cc8f5]", glow: "bg-[#5ab0f0]/25" },
  maize: { card: "from-maize/20 border-maize/30", icon: "bg-maize/15 text-maize", glow: "bg-maize/20" },
  green: { card: "from-ok/20 border-ok/30", icon: "bg-ok/15 text-ok", glow: "bg-ok/20" },
  violet: { card: "from-[#a78bfa]/24 border-[#a78bfa]/30", icon: "bg-[#a78bfa]/18 text-[#c4b5fd]", glow: "bg-[#a78bfa]/25" },
} as const;

const RECENT_LIMIT = 10;
const DAY = 86_400_000;
const number = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const axisDate = new Intl.DateTimeFormat("en-US", { timeZone: ANALYTICS_TIME_ZONE, month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat("en-US", { timeZone: ANALYTICS_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
const shortDate = (iso: string) => axisDate.format(new Date(iso));
const longDate = (iso: string) => fullDate.format(new Date(iso));

export function AnalyticsView({
  data,
  bounds,
  ranges,
  allTimeHref,
}: {
  data: AnalyticsData;
  bounds: RangeBounds;
  ranges: RangeOption[];
  allTimeHref: string;
}) {
  const s = summarize(data);
  const compareText = bounds.from
    ? `vs the previous ${Math.round((bounds.to.getTime() - bounds.from.getTime()) / DAY)} days`
    : "vs an earlier period";
  const rangeMenu = <RangeMenu key={bounds.range} options={ranges} current={bounds.range} />;

  if (data.checkins_all_time === 0) {
    return (
      <div className="space-y-6">
        <StatCards s={s} bounds={bounds} compareText={compareText} />
        <section className={`${card} relative overflow-hidden`}>
          <GhostChart />
          <EmptyState headingLevel="h2" title="Analytics fill in after your first event with check-ins" className="relative">
            Open check-in at an event and the charts, attendance table and insights show up here.
          </EmptyState>
        </section>
        <VercelCard />
      </div>
    );
  }

  const inRange = s.checkins.value > 0;
  const noneInRange = (
    <p className="rounded-xl border border-dashed border-line/70 bg-bg-2/60 px-4 py-8 text-center text-fg-2">
      No check-ins {bounds.inRange}.{" "}
      {bounds.range !== "all" && (
        <Link href={allTimeHref} className="font-semibold text-maize underline-offset-2 hover:underline">
          See all time
        </Link>
      )}
    </p>
  );
  const row = "grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]";

  return (
    <div className="space-y-6">
      <StatCards s={s} bounds={bounds} compareText={compareText} />

      <div className={row}>
        <ChartCard title="Attendance over time" subtitle={bounds.description} icon={TrendingUp} action={rangeMenu}>
          {data.events.length ? <AttendanceChart events={data.events} /> : noneInRange}
        </ChartCard>
        <ChartCard title="Check-ins by category" subtitle={capitalize(bounds.inRange)} icon={PieChart}>
          {inRange ? <CategoryDonut data={data.by_category} /> : noneInRange}
        </ChartCard>
      </div>

      <div className={row}>
        <ChartCard title="Member growth" subtitle="New sign-ups per month and the running total" icon={UserPlus}>
          <GrowthChart data={data} />
        </ChartCard>
        <ChartCard title="When people check in" subtitle="Time after the event starts" icon={Clock3}>
          {inRange ? <TimingInsight data={data} /> : noneInRange}
        </ChartCard>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
        <ChartCard title="Came back" subtitle="Came to 2 or more events" icon={Repeat}>
          {inRange ? <ReturningInsight data={data} inRange={bounds.inRange} /> : noneInRange}
        </ChartCard>
        <VercelCard />
      </div>

      <ChartCard title="Recent events" subtitle="Newest first. Open one to manage it." icon={CalendarDays}>
        {data.events.length ? <RecentEvents events={data.events} /> : noneInRange}
      </ChartCard>
    </div>
  );
}

/** A dashboard card: icon tile, title, a quiet subtitle, and an optional control on the right. */
function ChartCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${card} min-w-0 p-4 sm:p-6`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-maize/12 text-maize">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight text-fg sm:text-xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-fg-3">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stat cards

function StatCards({ s, bounds, compareText }: { s: ReturnType<typeof summarize>; bounds: RangeBounds; compareText: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        tint="sky"
        icon={Users}
        label="Members"
        value={number.format(s.members.total)}
        sub={`+${number.format(s.members.new)} new ${bounds.inRange}`}
        change={s.members.change}
        changeOf="new members"
        compareText={compareText}
      />
      <StatCard tint="maize" icon={CalendarDays} label="Events" sub={capitalize(bounds.inRange)} value={number.format(s.events.value)} change={s.events.change} compareText={compareText} />
      <StatCard tint="green" icon={ScanLine} label="Check-ins" sub={capitalize(bounds.inRange)} value={number.format(s.checkins.value)} change={s.checkins.change} compareText={compareText} />
      <StatCard
        tint="violet"
        icon={BarChart3}
        label="Average per event"
        sub="Check-ins per event"
        value={s.average.value == null ? "—" : oneDecimal.format(s.average.value)}
        change={s.average.change}
        compareText={compareText}
      />
    </div>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function StatCard({
  tint,
  icon: Icon,
  label,
  value,
  sub,
  change,
  changeOf,
  compareText,
}: {
  tint: keyof typeof TINTS;
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  change: number | null;
  /** What the change measures, when it isn't the big number (e.g. "new members"). */
  changeOf?: string;
  compareText: string;
}) {
  const t = TINTS[tint];
  return (
    <div className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-linear-to-br via-surface to-[#0d2741] p-4 shadow-card sm:p-5 ${t.card}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl ${t.glow}`} />
      <div className="relative flex items-start justify-between gap-2">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl sm:size-11 ${t.icon}`}>
          <Icon className="size-5" />
        </span>
        <ChangeBadge change={change} />
      </div>
      <p className="relative mt-4 text-sm font-semibold text-fg-2">{label}</p>
      <p className="relative mt-1 font-display text-3xl leading-none font-bold text-fg tabular-nums sm:text-4xl">{value}</p>
      <p className="relative mt-2 text-sm text-fg-2">{sub}</p>
      <p className="relative mt-auto pt-3 text-xs text-fg-3">
        {change == null ? "No earlier period to compare" : `${changeOf ? `${capitalize(changeOf)} ` : ""}${compareText}`}
      </p>
    </div>
  );
}

/** ▲ green / ▼ red, only with a real comparison; "—" otherwise. Never color alone. */
function ChangeBadge({ change }: { change: number | null }) {
  const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums";
  if (change == null) {
    return (
      <span className={`${pill} bg-white/[0.06] text-fg-3`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No change to show</span>
      </span>
    );
  }
  const pct = Math.round(change * 100);
  if (pct === 0) return <span className={`${pill} bg-white/[0.06] text-fg-2`}>0%<span className="sr-only"> change</span></span>;
  const up = pct > 0;
  return (
    <span className={`${pill} ${up ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {formatChange(Math.abs(change)).replace("+", "")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Attendance over time

/**
 * Check-ins per event, oldest first: a smooth area line with a point per event.
 * Each point is a link to the event (its name says the event and the count),
 * and the peak and latest events are labeled in text above the chart.
 */
function AttendanceChart({ events }: { events: AnalyticsEvent[] }) {
  const n = events.length;
  const maxValue = Math.max(...events.map((e) => e.checkins));
  const top = niceMax(Math.max(1, maxValue) * 1.08);
  const ticks = axisTicks(top);
  const x = (i: number) => (n === 1 ? 50 : 2.5 + (i / (n - 1)) * 95);
  const y = (v: number) => 100 - (v / top) * 100;
  const pts = events.map((e, i) => ({ x: x(i), y: y(e.checkins) }));
  const line = smoothPath(pts);
  const area = n > 1 ? `${line}L${pts[n - 1].x},100L${pts[0].x},100Z` : "";

  const peakIndex = events.reduce((best, e, i) => (e.checkins > events[best].checkins ? i : best), 0);
  const latestIndex = n - 1;
  const peak = events[peakIndex];
  const latest = events[latestIndex];
  const phoneLabels = new Set(labelIndexes(n, 3));
  const deskLabels = new Set(labelIndexes(n, 6));
  const dense = n > 18;

  return (
    <div>
      <dl className="mb-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-3">
        <Callout label="Peak" value={peak.checkins} event={peak} dot="bg-maize" />
        {latestIndex !== peakIndex ? (
          <Callout label="Latest" value={latest.checkins} event={latest} dot="bg-[#5ab0f0]" />
        ) : (
          <Callout label="Events" value={n} sub={`${number.format(events.reduce((t, e) => t + e.checkins, 0))} check-ins in all`} dot="bg-[#5ab0f0]" />
        )}
      </dl>

      <div className="flex gap-2">
        {/* Y axis */}
        <div aria-hidden="true" className="relative h-56 w-7 shrink-0 text-right text-[11px] text-fg-3 tabular-nums sm:h-64">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${y(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-56 sm:h-64">
            {ticks.map((t) => (
              <div key={t} aria-hidden="true" className={`absolute inset-x-0 border-t ${t === 0 ? "border-line" : "border-dashed border-line/45"}`} style={{ top: `${y(t)}%` }} />
            ))}
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <defs>
                <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f0c413" stopOpacity="0.38" />
                  <stop offset="70%" stopColor="#f0c413" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#f0c413" stopOpacity="0" />
                </linearGradient>
              </defs>
              {area && <path d={area} fill="url(#attendance-fill)" />}
              {n > 1 && (
                <path d={line} fill="none" stroke="#f0c413" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            <ol aria-label="Check-ins per event, oldest first. Each opens the event.">
              {events.map((e, i) => (
                <li key={e.id}>
                  <ChartPoint e={e} x={pts[i].x} y={pts[i].y} dense={dense} highlight={i === peakIndex || i === latestIndex} />
                </li>
              ))}
            </ol>
          </div>
          {/* X axis: a few dates, never crowded. */}
          <div aria-hidden="true" className="relative mt-2 h-4 text-[11px] text-fg-3">
            {events.map((e, i) => {
              const phone = phoneLabels.has(i);
              const desk = deskLabels.has(i);
              if (!phone && !desk) return null;
              const shift = n === 1 ? "-translate-x-1/2" : i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2";
              const vis = phone && desk ? "" : phone ? "sm:hidden" : "hidden sm:block";
              return (
                <span key={e.id} className={`absolute whitespace-nowrap ${shift} ${vis}`} style={{ left: `${pts[i].x}%` }}>
                  {shortDate(e.starts_at)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-fg-3">Check-ins per event. Hover or focus a point for the event; select it to open the event.</p>
    </div>
  );
}

function Callout({ label, value, event, sub, dot }: { label: string; value: number; event?: AnalyticsEvent; sub?: string; dot: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line/50 bg-bg-2/60 px-3 py-2.5">
      <dt className="flex items-center gap-2 text-xs font-semibold tracking-wider text-fg-3 uppercase">
        <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
        {label}
      </dt>
      <dd className="mt-1 flex min-w-0 items-center gap-3">
        <span className="font-display text-2xl leading-none font-bold text-fg tabular-nums">{number.format(value)}</span>
        <span className="min-w-0 leading-tight">
          {event ? (
            <>
              <span className="sr-only">check-ins, </span>
              <span className="block truncate text-fg" title={event.title}>{event.title}</span>
              <span className="block text-xs text-fg-3">{longDate(event.starts_at)}</span>
            </>
          ) : (
            <span className="block text-fg-2">{sub}</span>
          )}
        </span>
      </dd>
    </div>
  );
}

function ChartPoint({ e, x, y, dense, highlight }: { e: AnalyticsEvent; x: number; y: number; dense: boolean; highlight: boolean }) {
  // Keep the tooltip inside the chart near the edges.
  const align = x < 22 ? "left-0" : x > 78 ? "right-0" : "left-1/2 -translate-x-1/2";
  const below = y < 30;
  return (
    <Link
      href={`/officer/events/${e.id}`}
      aria-label={`${e.title}, ${longDate(e.starts_at)}: ${e.checkins} check-ins`}
      className={`group absolute z-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-offset-0 hover:z-30 focus-visible:z-30 ${dense ? "size-5" : "size-7"}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        aria-hidden="true"
        className={`rounded-full border-2 border-bg bg-maize shadow-[0_0_0_3px_rgb(240_196_19/0.18)] transition-transform group-hover:scale-150 group-focus-visible:scale-150 ${
          dense && !highlight ? "size-2" : "size-3"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none invisible absolute z-10 w-max max-w-52 rounded-lg border border-line/80 bg-bg px-3 py-2 text-left text-xs opacity-0 shadow-lift transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${align} ${
          below ? "top-full mt-1.5" : "bottom-full mb-1.5"
        }`}
      >
        <span className="block truncate font-semibold text-fg">{e.title}</span>
        <span className="block text-fg-3">{longDate(e.starts_at)}</span>
        <span className="mt-1 block font-display text-sm font-bold text-maize tabular-nums">{e.checkins} check-ins</span>
      </span>
    </Link>
  );
}

/** Behind the empty state: a faint dashed sketch of the chart to come. */
function GhostChart() {
  const pts = [18, 30, 26, 44, 40, 58, 52, 70].map((v, i, a) => ({ x: (i / (a.length - 1)) * 100, y: 100 - v }));
  const line = smoothPath(pts);
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 w-full opacity-60">
      <defs>
        <linearGradient id="ghost-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0c413" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#f0c413" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L100,100L0,100Z`} fill="url(#ghost-fill)" />
      <path d={line} fill="none" stroke="#f0c413" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Category donut

/** Donut of check-ins by category, total in the middle, legend with count and %. */
function CategoryDonut({ data }: { data: AnalyticsData["by_category"] }) {
  const total = data.reduce((n, c) => n + c.checkins, 0);
  const shares = data.map((c) => (c.checkins / total) * 100);
  const gap = data.length > 1 ? 0.8 : 0;
  const segments = data.map((c, i) => ({
    ...c,
    share: shares[i],
    // Where this segment starts: the shares before it.
    offset: shares.slice(0, i).reduce((a, b) => a + b, 0),
    label: categoryInfo(c.category).label,
    color: CATEGORY_COLORS[c.category] ?? "#9fb3c8",
  }));
  const summary = segments.map((c) => `${c.label} ${c.checkins} (${formatPercent(c.share / 100)})`).join(", ");
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
      <div className="relative size-48 shrink-0">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Check-ins by category: ${summary}`}>
          <circle cx="80" cy="80" r="62" fill="none" stroke="var(--color-elevated)" strokeOpacity="0.6" strokeWidth="20" />
          {segments.map((c) => (
            <circle
              key={c.category}
              cx="80"
              cy="80"
              r="62"
              fill="none"
              stroke={c.color}
              strokeWidth="20"
              pathLength={100}
              // A hairline gap between segments so neighbours stay distinct.
              strokeDasharray={`${Math.max(c.share - gap, 0.1)} ${100 - c.share + gap}`}
              strokeDashoffset={-c.offset}
            />
          ))}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 grid place-content-center text-center">
          <p className="font-display text-4xl leading-none font-bold text-fg tabular-nums">{number.format(total)}</p>
          <p className="mt-1 text-xs tracking-wider text-fg-3 uppercase">Check-ins</p>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {segments.map((c) => (
          <li key={c.category} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-white/[0.02]">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 0 3px ${c.color}26` }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-fg">{c.label}</span>
            <span className="text-fg-2 tabular-nums">{number.format(c.checkins)}</span>
            <span className="w-12 text-right font-semibold text-fg tabular-nums">{formatPercent(c.share / 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member growth

/** New members per month (rounded gradient bars) with the running total. */
function GrowthChart({ data }: { data: AnalyticsData }) {
  const months = growthWithTotals(data);
  if (!months.length || months[months.length - 1].total === 0) {
    return <p className="rounded-xl border border-dashed border-line/70 bg-bg-2/60 px-4 py-8 text-center text-fg-2">No members yet.</p>;
  }
  const maxNew = Math.max(1, ...months.map((m) => m.new_members));
  const maxTotal = Math.max(1, ...months.map((m) => m.total));
  const n = months.length;
  const pts = months.map((m, i) => ({ x: ((i + 0.5) / n) * 100, y: 100 - (m.total / maxTotal) * 88 }));
  const last = months[n - 1];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div aria-hidden="true" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-2">
          <span className="flex items-center gap-2"><span className="h-3 w-2.5 rounded-sm bg-linear-to-t from-[#f08a5d] to-maize" />New that month</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded-full bg-[#5ab0f0]" />Running total</span>
        </div>
        <p className="text-sm text-fg-2">
          <span className="font-display text-lg font-bold text-fg tabular-nums">{number.format(last.total)}</span> members now
        </p>
      </div>
      {/* The picture; the table below says the same in text for screen readers. */}
      <div aria-hidden="true" className="overflow-x-auto pb-1">
        <div style={{ minWidth: `${n * 2.5}rem` }}>
          <div className="relative h-48">
            {/* The running-total line sits behind the bars and their labels. */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <path d={smoothPath(pts)} fill="none" stroke="#5ab0f0" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {pts.map((p, i) => (
              <span
                key={months[i].month}
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-[#5ab0f0]"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-2">
              {months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 rounded-md bg-surface/85 px-1 text-xs font-semibold text-fg tabular-nums">{m.new_members > 0 ? `+${m.new_members}` : ""}</span>
                  <div
                    className="w-full max-w-9 rounded-t-[10px] rounded-b-[3px] bg-linear-to-t from-[#f08a5d] to-maize shadow-[0_8px_20px_-10px_rgb(240_196_19/0.6)]"
                    style={{ height: `${(m.new_members / maxNew) * 72}%`, minHeight: m.new_members ? 4 : 0 }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-2 border-t border-line/60 pt-2">
            {months.map((m) => (
              <div key={m.month} className="flex-1 text-center text-xs">
                <p className="text-fg-2">{monthLabel(m.month)}</p>
                <p className="font-semibold text-[#8cc8f5] tabular-nums">{number.format(m.total)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>New members per month and total members</caption>
        <thead>
          <tr><th scope="col">Month</th><th scope="col">New members</th><th scope="col">Total members</th></tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}><th scope="row">{monthLabel(m.month)}</th><td>{m.new_members}</td><td>{m.total}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insights

function TimingInsight({ data }: { data: AnalyticsData }) {
  const t = timingSummary(data.timing);
  if (!t) return null;
  const max = Math.max(...TIMING_BUCKETS.map((b) => (data.timing[b.key] as number) ?? 0));
  return (
    <div>
      <p className="font-display text-lg leading-snug font-bold text-fg">{t.headline}.</p>
      <p className="mt-1 text-sm text-fg-2">{t.detail}</p>
      <ul className="mt-5 space-y-3" aria-label="Check-ins by time after the event starts">
        {TIMING_BUCKETS.map((b) => {
          const count = (data.timing[b.key] as number) ?? 0;
          return (
            <li key={b.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
              <span className="text-fg-2">{b.label}</span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-elevated/70">
                <span className="block h-full rounded-full bg-linear-to-r from-[#f08a5d] to-maize" style={{ width: `${(count / Math.max(1, max)) * 100}%` }} />
              </span>
              <span className="text-right font-semibold text-fg tabular-nums">
                {formatPercent(count / t.total)}
                <span className="sr-only"> ({count} check-ins)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReturningInsight({ data, inRange }: { data: AnalyticsData; inRange: string }) {
  const { attendees, two_plus } = data.returning;
  const share = attendees ? two_plus / attendees : 0;
  const pct = Math.round(share * 100);
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`${formatPercent(share)} came to 2 or more events`}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-elevated)" strokeOpacity="0.6" strokeWidth="12" />
          {pct > 0 && (
            <circle cx="60" cy="60" r="50" fill="none" stroke="#34d399" strokeWidth="12" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
          )}
        </svg>
        <p aria-hidden="true" className="absolute inset-0 grid place-content-center font-display text-2xl font-bold text-fg tabular-nums">
          {formatPercent(share)}
        </p>
      </div>
      <p className="text-sm text-fg-2">
        Of the <span className="font-semibold text-fg">{number.format(attendees)}</span> {attendees === 1 ? "person" : "people"} who checked in {inRange},{" "}
        <span className="font-semibold text-fg">{number.format(two_plus)}</span> came to 2 or more events.
      </p>
    </div>
  );
}

function VercelCard() {
  return (
    <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-12 -bottom-12 size-44 rounded-full bg-[#5ab0f0]/15 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#5ab0f0]/15 text-[#8cc8f5]">
          <Globe className="size-5" />
        </span>
        <div>
          <h2 className="text-lg leading-tight text-fg sm:text-xl">Page views &amp; flyer scans</h2>
          <p className="mt-0.5 text-sm text-fg-3">Website traffic</p>
        </div>
      </div>
      <p className="relative mt-4 text-sm text-fg-2">
        Visits, top pages and flyer scans (<code className="text-fg">/join/src/…</code>) are in Vercel Analytics.
      </p>
      <a href={VERCEL_ANALYTICS_URL} target="_blank" rel="noopener noreferrer" className={button({ variant: "secondary", size: "sm", className: "relative mt-4" })}>
        Open Vercel Analytics
        <ExternalLink aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent events

function RecentEvents({ events }: { events: AnalyticsEvent[] }) {
  const recent = withCovers([...events].reverse().slice(0, RECENT_LIMIT));
  return (
    <div>
      {/* Table when there's room (from xl, like Members: below that, with the officer
          sidebar, the columns don't fit and the page scrolled sideways); cards otherwise. */}
      {/* Fixed layout: long titles truncate instead of widening the table. */}
      <table className="hidden w-full table-fixed text-left text-sm xl:table">
        <colgroup>
          <col />
          <col className="w-30" />
          <col className="w-22" />
          <col className="w-18" />
          <col className="w-34" />
          <col className="w-30" />
        </colgroup>
        <thead className="text-xs tracking-wider text-fg-3 uppercase">
          <tr className="border-b border-line/60">
            <th scope="col" className="py-2.5 pr-3 font-semibold">Event</th>
            <th scope="col" className="px-2 py-2.5 font-semibold">Date</th>
            <th scope="col" className="px-2 py-2.5 text-right font-semibold">Check-ins</th>
            <th scope="col" className="px-2 py-2.5 text-right font-semibold">RSVPs</th>
            <th scope="col" className="px-2 py-2.5 font-semibold">Show-up rate</th>
            <th scope="col" className="py-2.5 pl-2 text-right font-semibold">New / returning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {recent.map((e) => (
            <tr key={e.id} className="transition-colors hover:bg-white/[0.025]">
              <td className="min-w-0 py-3 pr-3"><EventLink e={e} /></td>
              <td className="px-2 py-3 whitespace-nowrap text-fg-2">{longDate(e.starts_at)}</td>
              <td className="px-2 py-3 text-right font-display text-base font-bold text-fg tabular-nums">{e.checkins}</td>
              <td className="px-2 py-3 text-right text-fg-2 tabular-nums">{e.rsvps}</td>
              <td className="px-2 py-3"><ShowUp e={e} /></td>
              <td className="py-3 pl-2 text-right whitespace-nowrap text-fg-2 tabular-nums">{e.first_timers} / {e.checkins - e.first_timers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line/40 xl:hidden">
        {recent.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <EventLink e={e} withDate />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Stat label="Check-ins">{e.checkins}</Stat>
              <Stat label="RSVPs">{e.rsvps}</Stat>
              <Stat label="Show-up rate"><ShowUp e={e} /></Stat>
              <Stat label="New / returning">{e.first_timers} / {e.checkins - e.first_timers}</Stat>
            </dl>
          </li>
        ))}
      </ul>
      {events.length > RECENT_LIMIT && <p className="mt-4 text-sm text-fg-3">The {RECENT_LIMIT} most recent of {events.length} events.</p>}
      <p className="mt-2 text-xs text-fg-3">Show-up rate: people who RSVP’d and checked in, out of everyone who RSVP’d. New: first event ever.</p>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-fg-3">{label}</dt>
      <dd className="font-semibold text-fg tabular-nums">{children}</dd>
    </div>
  );
}

/** Percentage (in text) with a small bar beside it; "—" with no RSVPs. */
function ShowUp({ e }: { e: AnalyticsEvent }) {
  const rate = showUpRate(e);
  if (rate == null) return <span className="text-fg-3" title="No RSVPs">—<span className="sr-only">No RSVPs</span></span>;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-elevated/80">
        <span className="block h-full rounded-full bg-ok" style={{ width: `${Math.min(100, rate * 100)}%` }} />
      </span>
      <span className="font-semibold text-fg tabular-nums">{formatPercent(rate)}</span>
    </span>
  );
}

function EventLink({ e, withDate = false }: { e: AnalyticsEvent & { cover: Parameters<typeof EventCover>[0]["cover"] }; withDate?: boolean }) {
  return (
    <Link href={`/officer/events/${e.id}`} className="group flex min-w-0 items-center gap-3">
      <EventCover category={e.category} cover={e.cover} className="aspect-[16/10] w-16 shrink-0 rounded-lg ring-1 ring-line/60" sizes="64px" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg group-hover:text-maize">{e.title}</span>
        <span className="text-sm text-fg-3">
          {categoryInfo(e.category).label}
          {withDate && <> · {longDate(e.starts_at)}</>}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-maize" />
    </Link>
  );
}
