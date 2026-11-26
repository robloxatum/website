// The founders on /about, in the order they're shown. Edited here, in code
// (not on /officer/content). No runtime imports: the unit tests read it too.
//
// The Roblox username is ONLY used on the server to look up the full-body
// avatar. It is never sent to the browser or shown on the page.

export type Founder = {
  name: string;
  role: string;
  /** Server-side avatar lookup only; never displayed. */
  robloxUsername: string;
  /** Optional one-liner under the role; hidden when empty. */
  oneLiner?: string;
};

export const FOUNDERS: readonly Founder[] = [
  { name: "Alexander Villagomez", role: "Cofounder", robloxUsername: "vaillex", oneLiner: "" },
  { name: "Emily Garcia", role: "Cofounder", robloxUsername: "yayy_drpepper", oneLiner: "" },
  { name: "Evan Stocker", role: "Cofounder", robloxUsername: "FinestBuilds", oneLiner: "" },
  { name: "Kaden Chirco", role: "Cofounder", robloxUsername: "noblemaxx", oneLiner: "" },
];
