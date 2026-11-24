import { Database, Eye, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/Primitives";
import { card, container } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Privacy" };

const CONTACT_EMAIL = "robloxatumich@gmail.com";
const linkClass = "font-semibold text-maize underline-offset-2 hover:underline";

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className={`${card} p-5 sm:p-7`}>
      <h2 className="flex items-center gap-3 text-xl text-fg">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated">
          <Icon aria-hidden="true" className="size-5 text-maize" />
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 leading-relaxed text-fg-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className={`${container} max-w-3xl! pt-10`}>
      <PageHeader label="The boring but important part" title="Privacy" />
      <div className="space-y-4">
        <Section icon={Database} title="What we collect">
          <p>When you sign in with your umich.edu Google account and check in at meetings, we store:</p>
          <ul className="list-disc space-y-1 pl-6 marker:text-maize">
            <li>Your name</li>
            <li>Your umich.edu email address and uniqname</li>
            <li>Your Roblox username, if you choose to add one</li>
            <li>Which club events you checked in to, and when</li>
          </ul>
          <p>
            We don&apos;t use ads or tracking cookies. The only cookie keeps you signed in. We count page visits with
            Vercel Web Analytics, which uses no cookies and doesn&apos;t identify you.
          </p>
        </Section>

        <Section icon={ShieldCheck} title="Why">
          <p>
            To track club attendance: who came to which meetings and how many events each member has attended. We
            don&apos;t sell your information or use it for anything else.
          </p>
        </Section>

        <Section icon={Eye} title="Who can see it">
          <p>
            Only club officers can see members&apos; information and attendance, and officers can export attendance
            lists for club records. You can see your own profile and attendance on your{" "}
            <Link href="/profile" className={linkClass}>
              profile page
            </Link>
            . Other members can&apos;t see your information. Public pages never show who attended; past events may
            show the total number of people who came.
          </p>
          <p>
            The data is stored with our hosting providers, Supabase (database and sign-in) and Vercel (website).
          </p>
        </Section>

        <Section icon={Trash2} title="Deleting your data">
          <p>
            To have your account and attendance history deleted, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>{" "}
            from your umich.edu address. You can also email us with any questions about your data.
          </p>
        </Section>
      </div>
    </div>
  );
}
