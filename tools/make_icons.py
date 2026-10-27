# 產生 PWA 圖示（只需執行一次）：python3 tools/make_icons.py
from PIL import Image, ImageDraw, ImageFont
import os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

def icon(size, path, pad=0):
    s = 1024
    im = Image.new("RGB", (s, s), "#1d4d3b")
    d = ImageDraw.Draw(im)
    t = 64  # 馬賽克階磚
    for y in (0, s - t * 2):
        for r in range(2):
            for c in range(s // t):
                if (c + r) % 2 == 0:
                    d.rectangle([c * t, y + r * t, c * t + t - 1, y + r * t + t - 1], fill="#f6efe0")
    m = 150 + pad
    d.rounded_rectangle([m, m + 40, s - m, s - m - 40], radius=40, outline="#f6efe0", width=18)
    f = ImageFont.truetype(FONT, 520 - pad)
    d.text((s / 2, s / 2 + 10), "發", font=f, fill="#f6efe0", anchor="mm")
    im.resize((size, size), Image.LANCZOS).save(os.path.join(HERE, "icons", path))

icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(512, "icon-maskable-512.png", pad=60)
icon(180, "apple-touch-icon.png")
