"""Home-screen app icons and iPhone splash screens (installable web app).

    python3 -I scripts/make-app-icons.py public/brand public src/app

Reads the original logo files in public/brand/ (git-ignored, kept locally) and
writes:
  public/icons/icon-192.png, icon-512.png            manifest "any" (rounded navy tile)
  public/icons/maskable-192.png, maskable-512.png    manifest "maskable" (full bleed,
                                                       logo inside the 80% safe zone)
  public/icons/badge-96.png                          Android notification badge (white
                                                       silhouette; Android uses the alpha)
  src/app/apple-icon.png                             iOS home screen (180, full bleed;
                                                       iOS rounds the corners)
  public/splash/<w>x<h>.png                          iPhone launch screens (portrait)
The splash sizes must match SPLASH_SCREENS in src/lib/app-install.ts.
Requires Pillow.
"""
import os
import sys
from PIL import Image, ImageDraw

brand, public, app = sys.argv[1], sys.argv[2], sys.argv[3]
NAVY = (6, 21, 37, 255)          # #061525: manifest background_color / theme_color
TILE = (8, 31, 64, 255)          # the brand navy of the logo files

# iPhone portrait screens in device pixels. Keep in sync with src/lib/app-install.ts.
SPLASH = [
    (1320, 2868), (1290, 2796), (1260, 2736), (1206, 2622), (1179, 2556), (1284, 2778),
    (1170, 2532), (1125, 2436), (1242, 2688), (828, 1792), (1242, 2208), (750, 1334),
]


def load(name):
    im = Image.open(os.path.join(brand, name)).convert("RGBA")
    return im.crop(im.getchannel("A").getbbox())


def save(im, path, colors=256):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE) if colors else im
    q.save(path, optimize=True)
    print(f"{path}: {im.size} {os.path.getsize(path) // 1024} KB")


def fit(im, box):
    """Scale `im` to fit a box x box square, keeping its aspect ratio."""
    s = box / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.Resampling.LANCZOS)


def centered(canvas, im, dy=0):
    canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2 + dy))
    return canvas


logo = load("robloxatum_logo_transparent.png")
wordmark = load("robloxatum_no_tagline_transparent.png")


def tile(size, logo_ratio, rounded):
    big = size * 4  # draw large, then downscale for smooth edges
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if rounded:
        ImageDraw.Draw(canvas).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * 0.22), fill=NAVY)
    else:
        canvas.paste(NAVY, (0, 0, big, big))
    centered(canvas, fit(logo, round(big * logo_ratio)))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


for size in (192, 512):
    save(tile(size, 0.62, rounded=True), os.path.join(public, "icons", f"icon-{size}.png"))
    # Maskable: the logo's corners must stay inside the centre circle of 80% diameter.
    save(tile(size, 0.52, rounded=False), os.path.join(public, "icons", f"maskable-{size}.png"))
save(tile(180, 0.6, rounded=False).convert("RGB"), os.path.join(app, "apple-icon.png"))

# Notification badge: white where the logo is, transparent elsewhere.
badge = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
mark = fit(logo, 80)
white = Image.new("RGBA", mark.size, (255, 255, 255, 255))
white.putalpha(mark.getchannel("A"))
save(centered(badge, white), os.path.join(public, "icons", "badge-96.png"), colors=0)

# Splash: the wordmark (it includes the logo), centred, on the app background.
for w, h in SPLASH:
    canvas = Image.new("RGBA", (w, h), NAVY)
    words = wordmark.resize((round(w * 0.74), round(w * 0.74 * wordmark.height / wordmark.width)), Image.Resampling.LANCZOS)
    save(centered(canvas, words).convert("RGB"), os.path.join(public, "splash", f"{w}x{h}.png"), colors=64)
