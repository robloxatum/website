// Security audit 3, L-8. No runtime imports: the unit tests run this file directly with Node.
//
// Next.js gives every "use server" action AND every "use cache" function a
// server reference ID, and its action handler runs whichever ID a POST names in
// the Next-Action header. Browsers only ever send action IDs, but anyone can send
// a "use cache" function's ID and run it with their own arguments (for example
// the Roblox lookups in lib/roblox.ts, skipping sign-in and the lookup limit).
// proxy.ts refuses those requests.
//
// The ID is 42 hex characters. Its first byte is Next's "info byte"; the top bit
// is 1 for "use cache" functions (next/dist/shared/lib/server-reference-info.js,
// extractInfoFromServerReferenceId). tests/server-reference.test.mjs checks this
// against Next's own decoder, so an upgrade that changes the format fails the tests.

const SERVER_REFERENCE_ID = /^[0-9a-f]{42}$/i;

/** True when a Next-Action header names a "use cache" function, never a real Server Action. */
export function isCacheFunctionReference(id: string | null | undefined): boolean {
  if (!id || !SERVER_REFERENCE_ID.test(id)) return false;
  return (parseInt(id.slice(0, 2), 16) & 0x80) !== 0;
}
