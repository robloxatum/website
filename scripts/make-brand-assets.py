"""Regenerate the web-sized brand assets from the original logo files.

    python3 -I scripts/make-brand-assets.py public/brand src/assets/brand src/app

Reads the originals in public/brand/ (git-ignored: kept locally, not deployed)
and writes trimmed wordmarks/icon to src/assets/brand/ plus favicon.ico,
icon.png, apple-icon.png, opengraph-image.png and twitter-image.png to src/app/.
Requires Pillow.
"""
import sys, os
from PIL import Image

brand, assets, app = sys.argv[1], sys.argv[2], sys.argv[3]
NAVY = (8, 31, 64, 255)
os.makedirs(assets, exist_ok=True)

def load(name):
    return Image.open(os.path.join(brand, name)).convert("RGBA")

def trim(im):
    return im.crop(im.getchannel("A").getbbox())

def save_png(im, path, colors=256):
    # Palette PNG with alpha keeps edges smooth and files small.
    q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE)
    q.save(path, optimize=True)
    print(f"{path}: {im.size} {os.path.getsize(path)//1024} KB")

def square(im, size, pad_ratio=0.0, bg=(0, 0, 0, 0)):
    side = max(im.size)
    side = int(side * (1 + 2 * pad_ratio))
    canvas = Image.new("RGBA", (side, side), bg)
    canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)

# Wordmarks: trim the transparent padding, 800px wide (next/image makes smaller sizes).
for src, out in [
    ("robloxatum_no_tagline_transparent.png", "wordmark-white.png"),
    ("robloxatum_no_tagline_transparent_navy.png", "wordmark-navy.png"),
    ("RobloxAtUM_tagline_transparent.png", "tagline-white.png"),
    ("RobloxAtUM_tagline_transparent_navy.png", "tagline-navy.png"),
]:
    w = trim(load(src))
    width = 1000 if out.startswith("tagline") else 800
    w = w.resize((width, round(width * w.height / w.width)), Image.Resampling.LANCZOS)
    save_png(w, os.path.join(assets, out))

# Square icon (trimmed) for in-page use.
icon = trim(load("robloxatum_logo_transparent.png"))
save_png(square(icon, 256), os.path.join(assets, "icon.png"))

# App icons.
save_png(square(icon, 512), os.path.join(app, "icon.png"))
apple = square(icon, 180, pad_ratio=0.14, bg=NAVY)   # iOS shows transparency as black
save_png(apple, os.path.join(app, "apple-icon.png"))
fav = square(icon, 64)
fav.save(os.path.join(app, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("favicon.ico", os.path.getsize(os.path.join(app, "favicon.ico")) // 1024, "KB")

# Social preview 1200x630 from the solid-navy tagline original.
src = Image.open(os.path.join(brand, "RobloxAtUM_tagline.png")).convert("RGBA")
art = src.crop((150, 100, 1450, 370))  # logo + tagline with even margins
target_w = 1040
art = art.resize((target_w, round(target_w * art.height / art.width)), Image.Resampling.LANCZOS)
og = Image.new("RGBA", (1200, 630), NAVY)
og.alpha_composite(art, ((1200 - art.width) // 2, (630 - art.height) // 2))
for name in ("opengraph-image.png", "twitter-image.png"):
    save_png(og, os.path.join(app, name))
