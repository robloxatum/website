// Only public values here: the project URL and the publishable (or anon) key.
// This app never uses the secret / service_role key.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See README.md.",
  );
}
