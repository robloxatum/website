"use client";

import { ErrorContent } from "@/components/ErrorContent";

/** Errors inside this route group: shown within the group's layout (header, nav). */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent {...props} />;
}
