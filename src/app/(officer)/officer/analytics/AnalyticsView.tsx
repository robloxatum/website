import {
  BarChart3,
  CalendarDays,
  Clock3,
  ExternalLink,
  Minus,
  PieChart,
  Repeat,
  ScanLine,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EventCover } from "@/components/art/Art";
import { EmptyState, Panel } from "@/components/ui/Blocks";
import { ProgressBar } from "@/components/ui/Primitives";
import { button, card } from "@/components/ui/styles";
import {
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
import { withCovers } from "@/lib/event-covers";
import { formatDate } from "@/lib/time";

/** Where page views and flyer scans live (Vercel Web Analytics). */
const VERCEL_ANALYTICS_URL = "https://vercel.com/dashboard";

/** One distinct color per category; every chart also labels them in text. */
const CATEGORY_COLORS: Record<string, string> = {
  game_night: "#f0c413",
  workshop: "#5ab0f0",
  game_jam: "#f08a5d",
  social: "#34d399",
  meeting: "#9fb3c8",
  partner: "#e879a6",
};

const RECENT_LIMIT = 10;
const DAY = 86_400_000;
const number = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function AnalyticsView({ data, bounds, allTimeHref }: { data: AnalyticsData; bounds: RangeBounds; allTimeHref: string }) {
  const s = summarize(data);
  const compareText = bounds.from
    ? `vs the previous ${Math.round((bounds.to.getTime() - bounds.from.getTime()) / DAY)} days`
    : "vs an earlier period";

  if (data.checkins_all_time === 0) {
    return (
      <div className="space-y-6">
        <StatCards s={s} bounds={bounds} compareText={compareText} />
        <div className={card}>
          <EmptyState headingLevel="h2" title="Analytics fill in after your first event with check-ins">
            Open check-in at an event and the charts, attendance table and insights show up here.
          </EmptyState>
        </div>
        <VercelCard />
      </div>
    );
  }

  const inRange = s.checkins.value > 0;
  const noneInRange = (
    <p className="rounded-xl border border-line/60 bg-bg-2 px-4 py-6 text-center text-fg-2">
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
        <Panel title="Attendance over time" icon={BarChart3}>
          {data.events.length ? <AttendanceChart events={data.events} /> : noneInRange}
        </Panel>
        <Panel title="By category" icon={PieChart}>
          {inRange ? <CategoryDonut data={data.by_category} /> : noneInRange}
        </Panel>
      </div>

      <div className={row}>
        <Panel title="Member growth" icon={UserPlus}>
          <GrowthChart data={data} />
        </Panel>
        <Panel title="When people check in" icon={Clock3}>
          {inRange ? <TimingInsight data={data} /> : noneInRange}
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
        <Panel title="Came back" icon={Repeat}>
          {inRange ? <ReturningInsight data={data} inRange={bounds.inRange} /> : noneInRange}
        </Panel>
        <VercelCard />
      </div>

      <Panel title="Recent events" icon={CalendarDays}>
        {data.events.length ? <RecentEvents events={data.events} /> : noneInRange}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards

function StatCards({ s, bounds, compareText }: { s: ReturnType<typeof summarize>; bounds: RangeBounds; compareText: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Users}
        label="Members"
        value={number.format(s.members.total)}
        sub={`+${number.format(s.members.new)} new ${bounds.inRange}`}
        change={s.members.change}
        changeOf="new members"
        compareText={compareText}
      />
      <StatCard icon={CalendarDays} label="Events" sub={capitalize(bounds.inRange)} value={number.format(s.events.value)} change={s.events.change} compareText={compareText} />
      <StatCard icon={ScanLine} label="Check-ins" sub={capitalize(bounds.inRange)} value={number.format(s.checkins.value)} change={s.checkins.change} compareText={compareText} />
      <StatCard
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
  icon: Icon,
  label,
  value,
  sub,
  change,
  changeOf,
  compareText,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  change: number | null;
  /** What the change measures, when it isn't the big number (e.g. "new members"). */
  changeOf?: string;
  compareText: string;
}) {
  return (
    <div className={`${card} flex flex-col gap-3 p-5`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-maize/12 text-maize">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <p className="font-semibold text-fg-2">{label}</p>
      </div>
      <p className="font-display text-4xl leading-none font-bold text-fg">{value}</p>
      <p className="text-sm text-fg-2">{sub}</p>
      <Change change={change} changeOf={changeOf} compareText={compareText} />
    </div>
  );
}

function Change({ change, changeOf, compareText }: { change: number | null; changeOf?: string; compareText: string }) {
  if (change == null) {
    return (
      <p className="mt-auto text-sm text-fg-3">
        <span aria-hidden="true">— </span>No earlier data to compare
      </p>
    );
  }
  const up = change > 0;
  const flat = Math.round(change * 100) === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <p className={`mt-auto flex flex-wrap items-center gap-x-1.5 text-sm ${flat ? "text-fg-2" : up ? "text-ok" : "text-bad"}`}>
      <Icon aria-hidden="true" className="size-4" />
      <span className="font-semibold">
        <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"} </span>
        {flat ? "0%" : formatChange(change)}
      </span>
      <span className="text-fg-3">
        {changeOf ? `${changeOf} ` : ""}
        {compareText}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Charts

/** Check-ins per event, oldest first, one labeled bar per event. */
function AttendanceChart({ events }: { events: AnalyticsEvent[] }) {
  const max = Math.max(1, ...events.map((e) => e.checkins));
  const list = (
    <ol className="space-y-3" aria-label="Check-ins per event, oldest first">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3rem]">
          <p className="min-w-0 text-sm">
            <span className="block truncate font-semibold text-fg" title={e.title}>{e.title}</span>
            <span className="text-fg-3">{formatDate(e.starts_at)}</span>
          </p>
          <span className="text-right font-display font-bold text-fg tabular-nums sm:order-last">
            {e.checkins}
            <span className="sr-only"> check-ins</span>
          </span>
          <div aria-hidden="true" className="col-span-2 h-3 overflow-hidden rounded-full bg-elevated/70 sm:col-span-1">
            <div className="h-full rounded-full bg-maize" style={{ width: `${(e.checkins / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
  if (events.length <= 12) return list;
  return (
    // Many events: scroll inside the card instead of a very long page.
    <div role="region" aria-label="Check-ins per event (scrollable)" tabIndex={0} className="-mr-2 max-h-[30rem] overflow-y-auto pr-2 focus-visible:outline-2 focus-visible:outline-maize">
      {list}
    </div>
  );
}

/** Donut of check-ins by category, with a text legend (count and %). */
function CategoryDonut({ data }: { data: AnalyticsData["by_category"] }) {
  const total = data.reduce((n, c) => n + c.checkins, 0);
  const shares = data.map((c) => (c.checkins / total) * 100);
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
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Check-ins by category: ${summary}`}>
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--color-elevated)" strokeWidth="24" />
          {segments.map((c) => (
            <circle
              key={c.category}
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke={c.color}
              strokeWidth="24"
              pathLength={100}
              // A hairline gap between segments so neighbours stay distinct.
              strokeDasharray={`${Math.max(c.share - (segments.length > 1 ? 0.6 : 0), 0.1)} ${100 - c.share + (segments.length > 1 ? 0.6 : 0)}`}
              strokeDashoffset={-c.offset}
            />
          ))}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 grid place-content-center text-center">
          <p className="font-display text-3xl font-bold text-fg">{number.format(total)}</p>
          <p className="text-xs text-fg-3">check-ins</p>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5">
        {segments.map((c) => (
          <li key={c.category} className="flex items-center gap-3 text-sm">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: c.color }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-fg">{c.label}</span>
            <span className="text-fg tabular-nums">{number.format(c.checkins)}</span>
            <span className="w-11 text-right text-fg-3 tabular-nums">{formatPercent(c.share / 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** New members per month (bars) with the running total (line + numbers). */
function GrowthChart({ data }: { data: AnalyticsData }) {
  const months = growthWithTotals(data);
  if (!months.length || months[months.length - 1].total === 0) {
    return <p className="text-fg-2">No members yet.</p>;
  }
  const maxNew = Math.max(1, ...months.map((m) => m.new_members));
  const maxTotal = Math.max(1, ...months.map((m) => m.total));
  const n = months.length;
  const points = months.map((m, i) => `${((i + 0.5) / n) * 100},${100 - (m.total / maxTotal) * 100}`).join(" ");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-2" aria-hidden="true">
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-maize" />New members that month</span>
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded-full bg-[#5ab0f0]" />Total members</span>
      </div>
      {/* The picture; the table below says the same in text for screen readers. */}
      <div aria-hidden="true" className="overflow-x-auto pb-1">
        <div style={{ minWidth: `${n * 2.25}rem` }}>
          <div className="relative h-48">
            <div className="absolute inset-0 flex items-end gap-1.5">
              {months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-xs font-semibold text-fg tabular-nums">{m.new_members > 0 ? `+${m.new_members}` : ""}</span>
                  <div className="w-full max-w-10 rounded-t-md bg-maize" style={{ height: `${(m.new_members / maxNew) * 80}%`, minHeight: m.new_members ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <polyline points={points} fill="none" stroke="#5ab0f0" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-line/60 pt-2">
            {months.map((m) => (
              <div key={m.month} className="flex-1 text-center text-xs">
                <p className="text-fg-2">{monthLabel(m.month)}</p>
                <p className="text-[#8cc8f5] tabular-nums">{number.format(m.total)}</p>
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
      <p className="font-display text-xl font-bold text-fg">{t.headline}.</p>
      <p className="mt-1 text-sm text-fg-2">{t.detail}</p>
      <ul className="mt-5 space-y-2.5" aria-label="Check-ins by time after the event starts">
        {TIMING_BUCKETS.map((b) => {
          const count = (data.timing[b.key] as number) ?? 0;
          return (
            <li key={b.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
              <span className="text-fg-2">{b.label}</span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-elevated/70">
                <span className="block h-full rounded-full bg-maize" style={{ width: `${(count / Math.max(1, max)) * 100}%` }} />
              </span>
              <span className="text-right text-fg tabular-nums">
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
  return (
    <div>
      <p className="font-display text-4xl leading-none font-bold text-fg">{formatPercent(share)}</p>
      <p className="mt-2 text-sm text-fg-2">
        Of the {number.format(attendees)} {attendees === 1 ? "person" : "people"} who checked in {inRange}, {number.format(two_plus)} came to 2 or
        more events.
      </p>
      <div className="mt-4">
        <ProgressBar value={two_plus} max={Math.max(1, attendees)} label="Share who came to 2 or more events" />
      </div>
    </div>
  );
}

function VercelCard() {
  return (
    <section className={`${card} p-5`}>
      <h2 className="flex items-center gap-2.5 text-lg text-fg">
        <BarChart3 aria-hidden="true" className="size-5 text-maize" />
        Page views &amp; flyer scans
      </h2>
      <p className="mt-1.5 text-sm text-fg-2">
        Visits, top pages and flyer scans (<code className="text-fg">/join/src/…</code>) are in Vercel Analytics.
      </p>
      <a href={VERCEL_ANALYTICS_URL} target="_blank" rel="noopener noreferrer" className={button({ variant: "secondary", size: "sm", className: "mt-4" })}>
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
      {/* Table when there's room; cards otherwise. */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-line/60 text-xs tracking-wider text-fg-3 uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">Event</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Check-ins</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">RSVPs</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Showed up</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">New / returning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {recent.map((e) => (
            <tr key={e.id}>
              <td className="py-3 pr-3"><EventLink e={e} /></td>
              <td className="px-2 py-3 text-right font-semibold text-fg tabular-nums">{e.checkins}</td>
              <td className="px-2 py-3 text-right text-fg-2 tabular-nums">{e.rsvps}</td>
              <td className="px-2 py-3 text-right text-fg-2 tabular-nums"><ShowUp e={e} /></td>
              <td className="py-3 pl-2 text-right whitespace-nowrap text-fg-2 tabular-nums">{e.first_timers} / {e.checkins - e.first_timers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line/40 md:hidden">
        {recent.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <EventLink e={e} />
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <Stat label="Check-ins">{e.checkins}</Stat>
              <Stat label="RSVPs">{e.rsvps}</Stat>
              <Stat label="Showed up"><ShowUp e={e} /></Stat>
              <Stat label="New / returning">{e.first_timers} / {e.checkins - e.first_timers}</Stat>
            </dl>
          </li>
        ))}
      </ul>
      {events.length > RECENT_LIMIT && <p className="mt-4 text-sm text-fg-3">The {RECENT_LIMIT} most recent of {events.length} events.</p>}
      <p className="mt-2 text-xs text-fg-3">Showed up: people who RSVP’d and checked in, out of everyone who RSVP’d. New: first event ever.</p>
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

function ShowUp({ e }: { e: AnalyticsEvent }) {
  const rate = showUpRate(e);
  return rate == null ? <span title="No RSVPs">—</span> : <>{formatPercent(rate)}</>;
}

function EventLink({ e }: { e: AnalyticsEvent & { cover: Parameters<typeof EventCover>[0]["cover"] } }) {
  return (
    <Link href={`/officer/events/${e.id}`} className="group flex min-w-0 items-center gap-3">
      <EventCover category={e.category} cover={e.cover} className="aspect-[2/1] w-20 shrink-0 rounded-lg" sizes="80px" />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-fg group-hover:text-maize">{e.title}</span>
        <span className="text-sm text-fg-3">{formatDate(e.starts_at)}</span>
      </span>
    </Link>
  );
}
