import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/Notice";

export const metadata: Metadata = { title: "Privacy" };

const CONTACT_EMAIL = "robloxatumich@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle kicker="The boring but important part">Privacy</PageTitle>

      <div className="block-card space-y-6 p-5 leading-relaxed sm:p-8">
        <section>
          <h2 className="mb-2 text-xl">What we collect</h2>
          <p>When you sign in with your umich.edu Google account and check in at meetings, we store:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your name</li>
            <li>Your umich.edu email address and uniqname</li>
            <li>Your Roblox username, if you choose to add one</li>
            <li>Which club events you checked in to, and when</li>
          </ul>
          <p className="mt-2">
            We don&apos;t collect anything else, and we don&apos;t use ads or tracking cookies. The only
            cookie keeps you signed in.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl">Why</h2>
          <p>
            To track club attendance: who came to which meetings and how many events each member
            has attended. We don&apos;t sell your information or use it for anything else.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl">Who can see it</h2>
          <p>
            Only club officers can see members&apos; information and attendance, and officers can export
            attendance lists for club records. You can see your own profile and attendance on your{" "}
            <Link href="/profile" className="font-semibold underline">
              profile page
            </Link>
            . Other members can&apos;t see your information. Public event pages show events only,
            never who attended.
          </p>
          <p className="mt-2">
            The data is stored with our hosting providers, Supabase (database and sign-in) and
            Vercel (website).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl">Deleting your data</h2>
          <p>
            To have your account and attendance history deleted, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
              {CONTACT_EMAIL}
            </a>{" "}
            from your umich.edu address. You can also email us with any questions about your data.
          </p>
        </section>
      </div>
    </div>
  );
}
