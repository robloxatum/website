import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageTitle, SkeletonBlock } from "@/components/Notice";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, { title: string; body: string }> = {
  not_umich: {
    title: "That's not a umich.edu account",
    body: "Sign in with your University of Michigan Google account (uniqname@umich.edu).",
  },
  oauth: {
    title: "Sign-in didn't finish",
    body: "Something went wrong talking to Google. Please try again.",
  },
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle kicker="Members">Sign in</PageTitle>
      <Suspense fallback={<SkeletonBlock className="h-40" />}>
        <LoginPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginPanel({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? errors[params.error] : undefined;

  if (await getUser()) redirect(next);

  const checkingIn = next.startsWith("/checkin");

  return (
    <div className="space-y-4">
      {error && (
        <Notice tone="error" title={error.title}>
          {error.body}
        </Notice>
      )}
      <div className="block-card space-y-4 p-5">
        <p className="text-lg">
          {checkingIn
            ? "Sign in to finish checking in. We'll bring you right back."
            : "Use your umich.edu Google account."}
        </p>
        <GoogleButton next={next} />
        <p className="text-sm text-blue/70">
          Only @umich.edu accounts can sign in. We store your name, uniqname, optional Roblox
          username and which events you attended.{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
