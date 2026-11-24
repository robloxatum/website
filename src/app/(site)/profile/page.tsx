import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle, SkeletonBlock } from "@/components/Notice";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle kicker="You">Profile</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-96" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

type AttendanceRow = {
  checked_in_at: string;
  events: { id: string; title: string; starts_at: string } | null;
};

async function ProfileContent() {
  const profile = await requireMember("/profile");
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("checked_in_at, events(id, title, starts_at)")
    .eq("user_id", profile.id)
    .order("checked_in_at", { ascending: false })
    .returns<AttendanceRow[]>();
  const attendance = data ?? [];

  return (
    <div className="space-y-8">
      <ProfileForm
        mode="edit"
        uniqname={profile.uniqname}
        fullName={profile.full_name}
        robloxUsername={profile.roblox_username}
      />

      <section>
        <h2 className="mb-3 text-xl">
          Your attendance <span className="tag bg-maize align-middle">{attendance.length}</span>
        </h2>
        {attendance.length ? (
          <ul className="block-card divide-y-2 divide-blue/10">
            {attendance.map((a) => (
              <li key={a.checked_in_at + a.events?.id} className="flex justify-between gap-3 p-3">
                {a.events ? (
                  <Link href={`/events/${a.events.id}`} className="font-semibold hover:underline">
                    {a.events.title}
                  </Link>
                ) : (
                  <span>Event</span>
                )}
                <span className="shrink-0 text-blue/70">
                  {formatDate(a.events?.starts_at ?? a.checked_in_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="block-card p-4">No check-ins yet. See you at the next meeting!</p>
        )}
      </section>

      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-white w-full">
          Sign out
        </button>
      </form>
    </div>
  );
}
