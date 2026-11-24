import { CalendarCheck, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/Blocks";
import { CategoryBadge, Skeleton } from "@/components/ui/Primitives";
import { button, card, container } from "@/components/ui/styles";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <div className={`${container} max-w-2xl! pt-10`}>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

type AttendanceRow = {
  checked_in_at: string;
  events: { id: string; title: string; starts_at: string; category: string } | null;
};

async function ProfileContent() {
  const profile = await requireMember("/profile");
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("checked_in_at, events(id, title, starts_at, category)")
    .eq("user_id", profile.id)
    .order("checked_in_at", { ascending: false })
    .returns<AttendanceRow[]>();
  const attendance = data ?? [];
  const name = profile.full_name.trim() || profile.uniqname;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-maize font-display text-3xl font-extrabold text-navy">
          {name[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.18em] text-fg-2 uppercase">Your profile</p>
          <h1 className="truncate text-3xl text-fg">{name}</h1>
        </div>
      </div>

      <ProfileForm mode="edit" uniqname={profile.uniqname} fullName={profile.full_name} robloxUsername={profile.roblox_username} />

      <section>
        <h2 className="mb-3 flex items-center gap-2.5 text-xl text-fg">
          <CalendarCheck aria-hidden="true" className="size-6 text-maize" />
          Your attendance
          <span className="rounded-md bg-maize px-2 py-0.5 text-sm font-bold text-navy tabular-nums">{attendance.length}</span>
        </h2>
        {attendance.length ? (
          <ul className={`${card} divide-y divide-line/50`}>
            {attendance.map((a) => (
              <li key={a.checked_in_at + a.events?.id}>
                {a.events ? (
                  <Link href={`/events/${a.events.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]">
                    <span className="min-w-0">
                      <CategoryBadge category={a.events.category} />
                      <span className="mt-1 block truncate font-semibold text-fg">{a.events.title}</span>
                    </span>
                    <span className="shrink-0 text-sm text-fg-2">{formatDate(a.events.starts_at)}</span>
                  </Link>
                ) : (
                  <span className="flex justify-between px-4 py-3 text-fg-2">
                    Event <span>{formatDate(a.checked_in_at)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className={card}>
            <EmptyState title="No check-ins yet">See you at the next event!</EmptyState>
          </div>
        )}
      </section>

      <form action="/auth/signout" method="post">
        <button type="submit" className={button({ variant: "secondary", full: true })}>
          <LogOut aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
