import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageTitle, SkeletonBlock } from "@/components/Notice";
import { getProfile, getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { ProfileForm } from "../profile/ProfileForm";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle kicker="Almost there">Welcome!</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-80" />}>
        <WelcomeForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WelcomeForm({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/welcome?next=${next}`)}`);

  const profile = await getProfile();
  if (!profile) {
    return (
      <Notice tone="error" title="We couldn't find your profile">
        Make sure you signed in with your umich.edu account. If this keeps happening, tell an
        officer.
      </Notice>
    );
  }
  if (profile.onboarded_at) redirect(next);

  return (
    <div className="space-y-4">
      <p className="text-lg">Check your name, and add your Roblox username if you&apos;d like.</p>
      <ProfileForm
        mode="welcome"
        next={next}
        uniqname={profile.uniqname}
        fullName={profile.full_name}
        robloxUsername={profile.roblox_username}
      />
    </div>
  );
}
