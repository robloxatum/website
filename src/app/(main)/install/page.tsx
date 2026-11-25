import { Bell, Download, QrCode, Smartphone, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { InstallStatus, PlatformSteps } from "@/components/install/InstallGuide";
import { PageHeader } from "@/components/ui/Primitives";
import { card, container } from "@/components/ui/styles";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Get the app",
  description: "Add Roblox at UM to your Home Screen: one tap to check in, play and get event reminders.",
  path: "/install",
});

const PERKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Smartphone, title: "Opens like an app", body: "Full screen from your Home Screen, signed in." },
  { icon: QrCode, title: "Quick check-in", body: "Tap Check In and type the code on screen." },
  { icon: Bell, title: "Notifications", body: "Event reminders and “the game link is live”, if you want them." },
];

export default function InstallPage() {
  return (
    <div className={`${container} max-w-3xl! pt-10`}>
      <PageHeader label="Get the app" title="Add Roblox at UM to your Home Screen" description="No app store needed. It takes about 10 seconds." />
      <div className="space-y-6">
        <InstallStatus />

        <ul className="grid gap-3 sm:grid-cols-3">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className={`${card} flex gap-3 p-4 sm:flex-col`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-maize/15">
                <Icon aria-hidden="true" className="size-5 text-maize" />
              </span>
              <span>
                <span className="block font-semibold text-fg">{title}</span>
                <span className="block text-sm text-fg-2">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <PlatformSteps />

        <section className={`${card} space-y-2 p-5 text-fg-2`}>
          <h2 className="flex items-center gap-2 text-lg text-fg">
            <Download aria-hidden="true" className="size-5 text-maize" />
            Good to know
          </h2>
          <p>
            Sign in once in the app. On iPhone the app keeps its own sign-in, separate from Safari, so you may need to sign
            in again there.
          </p>
          <p>
            At an event, open the app and tap <span className="font-semibold text-fg">Check In</span> to type the code. Scanning
            the QR code with your camera opens your browser instead, which works too.
          </p>
          <p>Turn on notifications from your profile in the app.</p>
        </section>
      </div>
    </div>
  );
}
