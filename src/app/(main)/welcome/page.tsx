import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandIcon } from "@/components/Logo";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Primitives";
import { container } from "@/components/ui/styles";
import { getProfile, getUser } from "@/lib/auth";
import { callName } from "@/lib/names";
import { safeNext } from "@/lib/safe-next";
import { ProfileForm } from "../profile/ProfileForm";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <div className={`${container} max-w-md! pt-10`}>
      <BrandIcon className="size-14" alt="" />
      <p className="mt-4 text-sm font-semibold text-maize">Almost there</p>
      <h1 className="mt-1 text-4xl text-fg">Welcome!</h1>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <WelcomeForm searchParams={searchParams} />
        </Suspense>
      </div>
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
      <Alert tone="error" title="We couldn't find your profile">
        Make sure you signed in with your umich.edu account. If this keeps happening, tell an officer.
      </Alert>
    );
  }
  if (profile.onboarded_at) redirect(next);

  return (
    <div className="space-y-4">
      <p className="text-lg text-fg-2">
        Hi {callName(profile)}! Add a nickname and your Roblox username if you&apos;d like.
      </p>
      <ProfileForm
        mode="welcome"
        next={next}
        uniqname={profile.uniqname}
        fullName={profile.full_name}
        nickname={profile.nickname}
        robloxUsername={profile.roblox_username}
      />
    </div>
  );
}
