import { BarChart3, Clock, Database, Eye, Share2, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { CLUB_EMAIL } from "@/lib/links";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/Primitives";
import { card, container } from "@/components/ui/styles";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "What Roblox at UM stores about members, why, and who can see it.",
  path: "/privacy",
});

const CONTACT_EMAIL = CLUB_EMAIL;
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
        <Section icon={Database} title="What we store">
          <p>When you sign in with your umich.edu Google account, we store:</p>
          <ul className="list-disc space-y-1 pl-6 marker:text-maize">
            <li>Your name (from Google) and your umich.edu email address and uniqname</li>
            <li>A nickname, if you add one</li>
            <li>
              Your Roblox username, if you add one, and your Roblox user ID, which we look up from Roblox&apos;s public
              API to show your avatar. We don&apos;t store the avatar picture; it loads from Roblox&apos;s image servers.
            </li>
            <li>
              The times you added or changed your Roblox username, to limit how often our site asks Roblox. Times older
              than a minute are deleted the next time you change it.
            </li>
            <li>Which club events you checked in to, and when</li>
            <li>Which events you tapped &ldquo;I&rsquo;m going&rdquo; for (RSVPs)</li>
            <li>
              The times of wrong check-in codes, to stop code guessing. Times older than a day are deleted the next time
              you check in.
            </li>
            <li>
              If you turn on notifications: for each device, the address your browser&apos;s push service gives us
              (Apple, Google, Mozilla or Microsoft) and which notifications you chose. Turning them off or signing out
              on that device deletes it.
            </li>
          </ul>
          <p>For officers, we also record which officer created an event or last edited site content.</p>
          <p>
            If you filled in our &ldquo;Get event updates&rdquo; Google Form, your answer is kept in the club&apos;s Google
            account, not on this site. Email us to have it removed.
          </p>
        </Section>

        <Section icon={ShieldCheck} title="Why">
          <p>
            To run the club: check-in at events, attendance records, knowing roughly how many people are coming, and
            showing your Roblox avatar. We don&apos;t sell your information, show ads, or use it for anything else.
          </p>
        </Section>

        <Section icon={Eye} title="Who can see what">
          <ul className="list-disc space-y-2 pl-6 marker:text-maize">
            <li>
              <span className="font-semibold text-fg">You</span> can see your profile and check-ins on your{" "}
              <Link href="/profile" className={linkClass}>
                profile page
              </Link>{" "}
              (and change your nickname or Roblox username there), and your RSVP on each event&apos;s page.
            </li>
            <li>
              <span className="font-semibold text-fg">Club officers</span> can see members&apos; names, nicknames,
              uniqnames and emails, Roblox usernames and avatars, who checked in to each event, and who RSVP&apos;d. They
              can export attendance lists and a full backup (CSV files) for club records.
            </li>
            <li>
              <span className="font-semibold text-fg">Other members</span> can&apos;t see your information, your
              check-ins or your RSVPs.
            </li>
            <li>
              <span className="font-semibold text-fg">Everyone</span> sees event details. Past events may show the total
              number of people who came (only when 10 or more did). Who came, and RSVPs, are never public.
            </li>
          </ul>
        </Section>

        <Section icon={BarChart3} title="Analytics">
          <p>
            Officers see attendance analytics: totals only, such as check-ins per event, new and returning members,
            and when people check in. These are worked out from check-ins and RSVPs and never list names.
          </p>
          <p>
            We count page visits with Vercel Web Analytics, which uses no cookies and doesn&apos;t identify you. We
            remove anything after the &ldquo;?&rdquo; in addresses (like check-in codes) before it&apos;s counted.
          </p>
          <p>
            Our cookies keep you signed in (and one short-lived cookie finishes signing you in). Your browser also
            remembers, on your device only, announcements you closed and whether you closed the &ldquo;install&rdquo; bar.
          </p>
        </Section>

        <Section icon={Database} title="Where it's kept">
          <p>
            With our hosting providers: Supabase (database and sign-in) and Vercel (website and page-visit counts).
            Google handles sign-in, and Roblox provides avatar pictures. Notifications are delivered by your
            browser&apos;s push service; they say what&apos;s happening (like an event&apos;s name and time) but never
            contain game links.
          </p>
        </Section>

        <Section icon={Share2} title="Who we share it with">
          <p>
            We don&apos;t share your information with anyone else, with two exceptions that come with showing avatars. To
            find your Roblox user ID, our server sends the Roblox username you entered to Roblox. Avatar pictures load
            straight from Roblox&apos;s servers, which see your device&apos;s IP address, like any image on the web.
          </p>
        </Section>

        <Section icon={Clock} title="How long we keep it">
          <p>
            We keep your profile, check-ins and RSVPs while the club needs them for its records. You can ask us to
            delete them at any time. Flyers and covers that officers upload are public,
            and we remove a photo&apos;s hidden details (like where it was taken) before it&apos;s uploaded.
          </p>
        </Section>

        <Section icon={Trash2} title="Deleting your data">
          <p>
            You can remove your nickname or Roblox username on your profile page at any time, and undo an RSVP until the
            event ends. To have your account and attendance history deleted, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>{" "}
            from your umich.edu address. We&apos;ll reply as soon as we can. You can also email us with any questions about
            your data.
          </p>
        </Section>
      </div>
    </div>
  );
}
