/**
 * How the site names members.
 *  - callName: how we address the member themselves ("You're in, Alex!").
 *  - officerName: how officers see them ("Alexander Villagomez (Alex)").
 * The nickname rules match the profiles_nickname_check constraint in
 * supabase/migrations/20261201000000_nickname_locked_name.sql.
 */

type Named = { full_name: string; uniqname: string; nickname?: string | null };

export const NICKNAME_MAX = 30;
export const NICKNAME_RULES = `Nicknames are 1–${NICKNAME_MAX} characters: letters, numbers, spaces and . , ' - _ ! ? & ( ).`;

const LETTER = "A-Za-z0-9À-ÖØ-öø-ÿ";
const NICKNAME = new RegExp(`^[${LETTER} .,'’!?&()_-]+$`);
const HAS_LETTER = new RegExp(`[${LETTER}]`);

/** Trims and collapses spaces. Empty means "no nickname". */
export function cleanNickname(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

/** Error message for a cleaned nickname, or null if it's fine (or empty). */
export function nicknameError(nickname: string): string | null {
  if (!nickname) return null;
  if (nickname.length > NICKNAME_MAX || !NICKNAME.test(nickname) || !HAS_LETTER.test(nickname)) return NICKNAME_RULES;
  return null;
}

/** Nickname if set, otherwise first name, otherwise uniqname. */
export function callName(p: Named): string {
  return p.nickname?.trim() || p.full_name.trim().split(/\s+/)[0] || p.uniqname;
}

/** Full name with the nickname after it, e.g. "Alexander Villagomez (Alex)". */
export function officerName(p: Named): string {
  const name = p.full_name.trim() || p.uniqname;
  const nick = p.nickname?.trim();
  return nick && nick !== name ? `${name} (${nick})` : name;
}
