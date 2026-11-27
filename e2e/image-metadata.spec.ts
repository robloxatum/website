// Security audit 3, L-1: a flyer or cover uploaded from the officer event form
// is stored without its metadata. A phone photo's EXIF can say where it was
// taken (GPS) and with what camera, and the stored file is public.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { admin, SEEDED } from "./support/db";
import { expect, signIn, test } from "./support/fixtures";

const EXIF = {
  IFD0: { Make: "SyntheticCam", Model: "AUD3-Model" },
  IFD3: { GPSLatitudeRef: "N", GPSLatitude: "42/1 16/1 3012/100", GPSLongitudeRef: "W", GPSLongitude: "83/1 44/1 1/1" },
};
const LEAKS = ["Exif\0\0", "SyntheticCam", "AUD3-Model", "xmpmeta"];

/** A photo-like JPEG (1600 × 800, a cover's size) with camera, GPS and XMP metadata. */
async function phonePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 800, channels: 3, background: { r: 20, g: 40, b: 120 } } })
    .jpeg()
    .withExif(EXIF)
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
    .toBuffer();
}

/** "YYYY-MM-DDTHH:mm" in Ann Arbor time, for datetime-local inputs. */
function clubInput(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "one upload is enough"));

test("flyer and cover uploads are stored without EXIF (GPS, camera) or XMP", async ({ page }) => {
  const photo = await phonePhoto();
  for (const s of LEAKS) expect(photo.includes(s), `fixture has ${JSON.stringify(s)}`).toBe(true);

  await signIn(page, SEEDED.officer, "/officer/events/new");
  const title = `E2E Metadata ${randomUUID().slice(0, 6)}`;
  const start = new Date(Date.now() + 5 * 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Starts").fill(clubInput(start));
  await page.getByLabel("Ends").fill(clubInput(new Date(start.getTime() + 2 * 3600_000)));
  await page.getByLabel("Location").fill("BBB 1670");
  // The cover's name says PNG; the file is a JPEG. It's stored as what it is.
  await page.locator('input[name="cover_file"]').setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: photo });
  await page.locator('input[name="flyer_file"]').setInputFiles({ name: "IMG_0001.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/officer\/events\/[0-9a-f-]{36}\?saved=1$/);
  const id = page.url().match(/events\/([0-9a-f-]{36})/)![1];

  const { data: event } = await admin.from("events").select("flyer_path, cover_path, cover_width, cover_height").eq("id", id).single();
  try {
    expect(event!.flyer_path).toMatch(/\.jpg$/);
    expect(event!.cover_path).toMatch(/^covers\/.+\.jpg$/);
    expect([event!.cover_width, event!.cover_height]).toEqual([1600, 800]);
    for (const path of [event!.flyer_path, event!.cover_path]) {
      // The public URL, as anyone would fetch it.
      const { data } = admin.storage.from("event-flyers").getPublicUrl(path);
      const res = await fetch(data.publicUrl);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toBe("image/jpeg");
      const stored = Buffer.from(await res.arrayBuffer());
      for (const s of LEAKS) expect(stored.includes(s), `${path} still has ${JSON.stringify(s)}`).toBe(false);
      const meta = await sharp(stored).metadata();
      expect([meta.width, meta.height, meta.exif]).toEqual([1600, 800, undefined]);
    }
  } finally {
    await admin.storage.from("event-flyers").remove([event!.flyer_path, event!.cover_path].filter(Boolean));
    await admin.from("events").delete().eq("id", id);
  }
});
