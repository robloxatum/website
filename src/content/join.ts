/**
 * Copy for /join. Officers: edit freely; keep it short (people read this on a
 * phone right after scanning a flyer).
 */
export const pitch =
  "A student-led community for Roblox creators, players, and developers at U-M.";

export const whatWeDo = [
  { key: "game_night", title: "Game Nights", body: "Play popular Roblox games together with the community." },
  { key: "workshop", title: "Workshops", body: "Learn scripting, building, UI and game design from other students." },
  { key: "game_jam", title: "Game Jams", body: "Team up, build a game in a weekend, and show it off." },
  { key: "social", title: "Community", body: "Meet other creators, developers and Roblox fans at U-M." },
] as const;

// REVIEW: describe a real meeting. This is a reasonable default, not a record.
export const typicalMeeting = [
  "Quick announcements and what's coming up",
  "The main activity: a workshop, a game night, or jam time",
  "Hang out, team up, and help each other with projects",
];

// REVIEW: confirm these answers.
export const faq = [
  { q: "Does it cost anything?", a: "No. Membership and events are free." },
  { q: "Do I need experience?", a: "None at all. Plenty of members have never opened Roblox Studio. Bring a laptop if you have one." },
  {
    q: "When and where do you meet?",
    a: "It changes with each event. The next one is listed at the top of this page, and every event is on our Events page.",
  },
  { q: "Who can join?", a: "Any U-M student. Sign up with your umich.edu Google account." },
];
