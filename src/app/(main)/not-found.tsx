import { NotFoundContent } from "@/components/NotFoundContent";

export const metadata = { title: "Page not found", robots: { index: false } };

/** notFound() inside this group: the group layout already provides the page chrome. */
export default function NotFound() {
  return <NotFoundContent />;
}
