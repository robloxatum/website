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
  /** Optional LinkedIn profile (https://www.linkedin.com/in/... only); no icon when missing or not one. */
  linkedin?: string;
};

/**
 * Only a LinkedIn profile URL: https, www.linkedin.com exactly, /in/<profile>
 * (optional trailing slash), nothing else (no login, port, query or fragment).
 */
export function isLinkedInProfileUrl(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "www.linkedin.com" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    value.startsWith("https://www.linkedin.com/in/") &&
    /^\/in\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  );
}

export const FOUNDERS: readonly Founder[] = [
  {
    name: "Alexander Villagomez",
    role: "Cofounder",
    robloxUsername: "vaillex",
    oneLiner: "",
    linkedin: "https://www.linkedin.com/in/alexander-villagomez/",
  },
  {
    name: "Emily Garcia",
    role: "Cofounder",
    robloxUsername: "yayy_drpepper",
    oneLiner: "",
    linkedin: "https://www.linkedin.com/in/emily-garcia-647678381/",
  },
  {
    name: "Evan Stocker",
    role: "Cofounder",
    robloxUsername: "FinestBuilds",
    oneLiner: "",
    linkedin: "https://www.linkedin.com/in/evanstocker/",
  },
  {
    name: "Kaden Chirco",
    role: "Cofounder",
    robloxUsername: "noblemaxx",
    oneLiner: "",
    linkedin: "https://www.linkedin.com/in/kaden-chirco-01a8552b1/",
  },
];
