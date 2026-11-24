import Link from "next/link";
import { getProfile } from "@/lib/auth";

export async function AccountNav() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <Link href="/login" className="btn btn-white btn-sm">
        Sign in
      </Link>
    );
  }

  const firstName = profile.full_name.split(" ")[0] || profile.uniqname;

  return (
    <div className="flex items-center gap-2">
      {profile.is_officer && (
        <Link href="/officer" className="btn btn-maize btn-sm">
          Officer
        </Link>
      )}
      <Link
        href="/profile"
        className="max-w-28 truncate border-2 border-white/30 px-3 py-1.5 text-sm font-semibold hover:border-maize hover:text-maize"
        title="Your profile"
      >
        {firstName}
      </Link>
    </div>
  );
}
