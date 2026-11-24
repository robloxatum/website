"""Social preview for /join.  python3 -I scripts/make-join-og.py public/brand <Montserrat.ttf> "src/app/(main)/join"
Montserrat: https://github.com/google/fonts/tree/main/ofl/montserrat (variable font)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
brand, font_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
NAVY, MAIZE, WHITE = (8, 31, 64, 255), (240, 196, 19, 255), (245, 247, 250, 255)
W, H = 1200, 630

og = Image.new("RGBA", (W, H), NAVY)
# Subtle diagonal light, like the site background.
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for i in range(0, 420, 6):
    a = int(26 * (1 - i / 420))
    gd.ellipse((W - 520 - i, -260 - i, W + 260 + i, 380 + i), outline=(22, 57, 86, a), width=6)
og.alpha_composite(glow)

logo = Image.open(os.path.join(brand, "RobloxAtUM_tagline_transparent.png")).convert("RGBA")
logo = logo.crop(logo.getchannel("A").getbbox())
lw = 860
logo = logo.resize((lw, round(lw * logo.height / logo.width)), Image.Resampling.LANCZOS)
og.alpha_composite(logo, ((W - lw) // 2, 150))

font = ImageFont.truetype(font_path, 46)
font.set_variation_by_name("ExtraBold")
text = "Join us · No experience needed"
d = ImageDraw.Draw(og)
tw = d.textlength(text, font=font)
pad_x, pad_y, y = 34, 18, 150 + logo.height + 70
box = ((W - tw) / 2 - pad_x, y - pad_y, (W + tw) / 2 + pad_x, y + 46 + pad_y + 8)
d.rounded_rectangle(box, radius=16, fill=MAIZE)
d.text(((W - tw) / 2, y), text, font=font, fill=NAVY)

for name in ("opengraph-image.png", "twitter-image.png"):
    path = os.path.join(out_dir, name)
    og.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    print(path, os.path.getsize(path) // 1024, "KB")
