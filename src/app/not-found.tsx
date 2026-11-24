import Link from "next/link";
import { BrandIcon } from "@/components/Logo";
import { button } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <BrandIcon className="mx-auto size-24" />
        <h1 className="text-4xl text-fg">404: Block not found</h1>
        <p className="text-lg text-fg-2">This page fell off the map.</p>
        <Link href="/" className={button({ size: "lg" })}>
          Respawn at home
        </Link>
      </div>
    </main>
  );
}
