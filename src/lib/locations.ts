/**
 * Building codes officers type in event locations ("CCCB 1420"), with full
 * names for event pages. Cards keep the short form. Add buildings here.
 */
export const BUILDINGS: Record<string, string> = {
  CCCB: "Central Campus Classroom Building",
  NUB: "North University Building",
  BBB: "Bob and Betty Beyster Building",
  EECS: "Electrical Engineering and Computer Science Building",
  MLB: "Modern Languages Building",
  AH: "Angell Hall",
  MH: "Mason Hall",
};

export type ResolvedLocation = {
  /** "Central Campus Classroom Building, Room 1420", or the location as typed. */
  label: string;
  /** Google Maps search for a known building; null otherwise. */
  mapUrl: string | null;
};

/** Expands a leading building code ("CCCB 1420", "nub room 2001", "BBB"). Unknown codes stay as typed. */
export function resolveLocation(location: string | null | undefined): ResolvedLocation | null {
  const text = location?.trim();
  if (!text) return null;
  const m = /^([A-Za-z]{2,6})(?![A-Za-z])[\s,:-]*(.*)$/.exec(text);
  const name = m ? BUILDINGS[m[1].toUpperCase()] : undefined;
  if (!m || !name) return { label: text, mapUrl: null };
  const rest = m[2].trim();
  const room = rest ? (/^\d/.test(rest) ? `Room ${rest}` : rest) : "";
  return {
    label: room ? `${name}, ${room}` : name,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Ann Arbor, MI`)}`,
  };
}
