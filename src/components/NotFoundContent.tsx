import Link from "next/link";
import { BrandIcon } from "@/components/Logo";
import { button } from "@/components/ui/styles";

/** 404 body. Wrapped by each route group's not-found so it sits inside that group's layout. */
export function NotFoundContent() {
  return (
    <div className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="space-y-4">
        <BrandIcon className="mx-auto size-24" alt="" />
        <h1 className="text-4xl text-fg">404: Block not found</h1>
        <p className="text-lg text-fg-2">This page fell off the map.</p>
        <Link href="/" className={button({ size: "lg" })}>
          Respawn at home
        </Link>
      </div>
    </div>
  );
}
