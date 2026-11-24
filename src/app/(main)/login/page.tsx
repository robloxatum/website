import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { BrandIcon } from "@/components/Logo";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Primitives";
import { card, container } from "@/components/ui/styles";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

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
    <div className={`${container} max-w-md! pt-10`}>
      <BrandIcon className="size-14" alt="" />
      <p className="mt-4 text-sm font-semibold text-maize">Members</p>
      <h1 className="mt-1 text-4xl text-fg">Sign in</h1>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-56" />}>
          <LoginPanel searchParams={searchParams} />
        </Suspense>
      </div>
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
        <Alert tone="error" title={error.title}>
          {error.body}
        </Alert>
      )}
      <div className={`${card} space-y-5 p-5 sm:p-6`}>
        <p className="text-lg text-fg">
          {checkingIn ? "Sign in to finish checking in. We'll bring you right back." : "Use your umich.edu Google account."}
        </p>
        <GoogleButton next={next} />
        <p className="text-sm text-fg-2">
          Only @umich.edu accounts can sign in. We store your name, uniqname, optional Roblox username and which events
          you attended.{" "}
          <Link href="/privacy" className="font-semibold text-maize hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
