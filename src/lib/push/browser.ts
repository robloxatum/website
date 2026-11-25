// Browser side of push notifications and the installed app. Client components only.

/** Opened from the home screen (installed app), not a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The service worker registration (registering it if the page hasn't yet). */
export async function workerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** This device's current push subscription, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribe this device (reusing a subscription made with the same key). */
export async function subscribe(vapidPublicKey: string): Promise<PushSubscription> {
  const reg = await workerRegistration();
  const applicationServerKey = keyBytes(vapidPublicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const key = existing.options.applicationServerKey;
    const same = key && new Uint8Array(key).every((b, i) => b === applicationServerKey[i]) && key.byteLength === applicationServerKey.length;
    if (same) return existing;
    await existing.unsubscribe(); // made with an old key
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
}
