import Link from "next/link";
import { Notice } from "./Notice";

export function OfficersOnly() {
  return (
    <div className="space-y-4">
      <Notice tone="warning" title="Officers only">
        This page is for club officers. If you should have access, ask a current officer to make
        you one from the Members page.
      </Notice>
      <Link href="/" className="btn btn-white">
        Back home
      </Link>
    </div>
  );
}
