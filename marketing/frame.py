#!/usr/bin/env python3
"""Frame App Store screenshots: dark gradient + orange glow + iPhone bezel + headline + brand mark."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math
import sys

ROOT = Path(__file__).parent
RAW = ROOT / 'screenshots' / 'raw'
OUT = ROOT / 'screenshots' / 'framed'
LOGO = ROOT.parent / 'website' / 'apple-touch-icon.png'
STOCK_PLATE = ROOT / 'StockCake-Orange_Diamond_Plate-1759935-standard.jpg'

CANVAS_W = 1284
CANVAS_H = 2778

BG_TOP = (28, 28, 30)
BG_BOTTOM = (10, 10, 12)
ACCENT = (255, 138, 38)
WHITE = (255, 255, 255)

PHONE_WIDTH = 1050
PHONE_BOTTOM = 2545
BRAND_AREA_TOP = 2575
BRAND_AREA_BOTTOM = 2778
HEADLINE_TOP_MARGIN = 80
HEADLINE_PHONE_GAP = 40

SLOTS = [
    (1,  '01_dashboard.png',         'Run your business by the numbers',         'numbers'),
    (2,  '02_chen_warning.png',      'Catch underpriced quotes before you send', 'underpriced'),
    (3,  '03_labor_rate.png',        'Know your real hourly rate',               'real'),
    (4,  '04_business_settings.png', 'Set your numbers once. Applied everywhere.', 'once'),
    (5,  '05_quote_review.png',      'See your real margin, every quote',        'margin'),
    (6,  '06_pdf_preview.png',       'Branded proposals, in seconds',            'seconds'),
    (7,  '07_contract_portal.png',   'Clients sign on a branded web portal',     'sign'),
    (8,  '08_contract_mobile.png',   'Track every signed contract',              'signed'),
    (9,  '09_invoice.png',           'Track every payment, down to the cent',    'payment'),
    (10, '10_pricebook.png',         'Your catalog. Scan it. Import it.',        'catalog'),
]


def find_font(size, heavy=True):
    candidates = (
        [
            ('/System/Library/Fonts/Avenir Next.ttc', 8),   # Heavy
            ('/System/Library/Fonts/Avenir Next.ttc', 0),   # Bold
            ('/System/Library/Fonts/HelveticaNeue.ttc', 1), # Bold
        ]
        if heavy
        else [
            ('/System/Library/Fonts/Avenir Next.ttc', 0),   # Bold
            ('/System/Library/Fonts/HelveticaNeue.ttc', 1), # Bold
        ]
    )
    for path, idx in candidates:
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


def gradient_bg(w, h, top, bottom):
    col = Image.new('RGB', (1, h))
    px = col.load()
    for y in range(h):
        t = y / (h - 1)
        px[0, y] = (
            int(top[0] * (1 - t) + bottom[0] * t),
            int(top[1] * (1 - t) + bottom[1] * t),
            int(top[2] * (1 - t) + bottom[2] * t),
        )
    return col.resize((w, h), Image.NEAREST)


def stock_plate_bg(w, h, darken=0.55, desaturate=0.35):
    """Use the StockCake orange diamond plate as the background.
    darken: 0=original, 1=pitch black. desaturate: 0=full color, 1=grayscale.
    """
    img = Image.open(STOCK_PLATE).convert('RGB')
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    new_w, new_h = int(iw * scale), int(ih * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    img = img.crop((left, top, left + w, top + h))

    if desaturate > 0:
        gray = img.convert('L').convert('RGB')
        img = Image.blend(img, gray, desaturate)

    if darken > 0:
        black = Image.new('RGB', (w, h), (0, 0, 0))
        img = Image.blend(img, black, darken)

    canvas = img.convert('RGBA')

    vignette = Image.new('L', (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    for i in range(70):
        a = int(180 * (i / 70) ** 2.5)
        vd.rectangle([i * 5, i * 5, w - i * 5, h - i * 5], outline=a)
    vignette = vignette.filter(ImageFilter.GaussianBlur(120))
    darken_overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    darken_overlay.putalpha(vignette)
    canvas.alpha_composite(darken_overlay)
    return canvas


def make_diamond_tile(size):
    """One embossed diamond cell. Tiles seamlessly with full-edge diamonds at corners."""
    tile = Image.new('RGBA', (size, size), (44, 44, 48, 255))

    grad_col = Image.new('RGB', (1, size))
    gp = grad_col.load()
    for y in range(size):
        t = y / max(1, size - 1)
        v = int(125 * (1 - t) + 24 * t)
        gp[0, y] = (v, v, min(255, v + 4))
    grad = grad_col.resize((size, size), Image.NEAREST).convert('RGBA')

    dw = int(size * 0.62)
    dh = int(size * 0.70)
    cx, cy = size // 2, size // 2

    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).polygon(
        [(cx, cy - dh // 2), (cx + dw // 2, cy), (cx, cy + dh // 2), (cx - dw // 2, cy)],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    grad.putalpha(mask)
    tile.alpha_composite(grad)

    d = ImageDraw.Draw(tile)
    top, right, bot, left = (
        (cx, cy - dh // 2),
        (cx + dw // 2, cy),
        (cx, cy + dh // 2),
        (cx - dw // 2, cy),
    )
    d.line([left, top, right], fill=(235, 235, 240, 220), width=3)
    d.line([left, bot, right], fill=(0, 0, 0, 230), width=3)
    return tile


def diamond_plate_bg(w, h):
    """Embossed steel diamond plate background."""
    base = gradient_bg(w, h, (52, 52, 58), (16, 16, 20)).convert('RGBA')

    tile_size = 90
    tile = make_diamond_tile(tile_size)

    pattern = Image.new('RGBA', (w + tile_size, h + tile_size), (0, 0, 0, 0))
    offset_row = 0
    for y in range(0, h + tile_size, tile_size):
        ox = (tile_size // 2) if offset_row % 2 == 1 else 0
        for x in range(-tile_size, w + tile_size, tile_size):
            pattern.alpha_composite(tile, (x + ox, y))
        offset_row += 1
    pattern = pattern.crop((0, 0, w, h))
    base.alpha_composite(pattern)

    vignette = Image.new('L', (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    for i in range(60):
        a = int(220 * (i / 60) ** 2.5)
        vd.rectangle([i * 5, i * 5, w - i * 5, h - i * 5], outline=a)
    vignette = vignette.filter(ImageFilter.GaussianBlur(100))
    darken = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    darken.putalpha(vignette)
    base.alpha_composite(darken)
    return base


def add_glow(canvas, center, radius, color, alpha):
    cx, cy = center
    pad = radius + 100
    glow = Image.new('RGBA', (pad * 2, pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    steps = 40
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        a = int(alpha * ((1 - i / steps) ** 2))
        d.ellipse([pad - r, pad - r, pad + r, pad + r], fill=(*color, a))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    canvas.alpha_composite(glow, (cx - pad, cy - pad))
    return canvas


def round_corners(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def build_phone(shot_path, target_w):
    shot = Image.open(shot_path).convert('RGB')
    sw, sh = shot.size
    bezel_pad = 12
    inner_w = target_w - bezel_pad * 2
    inner_h = int(sh * inner_w / sw)
    shot_r = shot.resize((inner_w, inner_h), Image.LANCZOS)
    shot_r = round_corners(shot_r, radius=72)

    bw, bh = inner_w + bezel_pad * 2, inner_h + bezel_pad * 2
    bezel = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(bezel).rounded_rectangle([0, 0, bw, bh], radius=86, fill=(8, 8, 8, 255))
    bezel.alpha_composite(shot_r, (bezel_pad, bezel_pad))

    shadow = Image.new('RGBA', (bw + 200, bh + 200), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [100, 100, 100 + bw, 100 + bh], radius=86, fill=(0, 0, 0, 180)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))

    return bezel, shadow


def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], []
    for w in words:
        cur.append(w)
        bbox = draw.textbbox((0, 0), ' '.join(cur), font=font)
        if bbox[2] - bbox[0] > max_w and len(cur) > 1:
            cur.pop()
            lines.append(' '.join(cur))
            cur = [w]
    if cur:
        lines.append(' '.join(cur))
    return lines


def draw_underline(draw, x, y, w, color):
    """Tapered brush stroke under a word. Thicker in the middle, soft tapered ends."""
    steps = 80
    max_thick = 24
    min_thick = 3
    top_pts = []
    bot_pts = []
    for i in range(steps + 1):
        t = i / steps
        thick_factor = math.sin(t * math.pi) ** 0.6
        thick = min_thick + (max_thick - min_thick) * thick_factor
        px = x + w * t
        rise = math.sin(t * math.pi) * 2.5
        py = y - rise
        top_pts.append((px, py - thick / 2))
        bot_pts.append((px, py + thick / 2))
    polygon = top_pts + list(reversed(bot_pts))
    draw.polygon(polygon, fill=color)


def draw_headline(canvas, text, accent_word, font, area_top, area_bottom):
    """Draw headline with the accent word rendered in orange instead of white."""
    draw = ImageDraw.Draw(canvas)
    max_w = CANVAS_W - 140
    lines = wrap_text(draw, text, font, max_w)
    line_h = int(font.size * 1.10)
    total_h = line_h * len(lines)
    start_y = area_top + (area_bottom - area_top - total_h) // 2

    aw = accent_word.lower().strip('.,!?')
    for i, line in enumerate(lines):
        ly = start_y + i * line_h
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        lx = (CANVAS_W - lw) // 2

        words = line.split()
        cursor_x = lx
        for wi, w in enumerate(words):
            color = ACCENT if aw in w.lower().strip('.,!?') else WHITE
            draw.text((cursor_x, ly), w, font=font, fill=color)
            wb = draw.textbbox((0, 0), w, font=font)
            ww = wb[2] - wb[0]
            space_w = draw.textbbox((0, 0), ' ', font=font)[2]
            cursor_x += ww + space_w


def render(slot, filename, headline, underline_word):
    canvas = stock_plate_bg(CANVAS_W, CANVAS_H)

    bezel, shadow = build_phone(RAW / filename, PHONE_WIDTH)
    bx = (CANVAS_W - bezel.width) // 2
    by = PHONE_BOTTOM - bezel.height
    canvas = add_glow(
        canvas,
        center=(CANVAS_W // 2, by + bezel.height // 2),
        radius=850,
        color=ACCENT,
        alpha=130,
    )

    headline_area_top = HEADLINE_TOP_MARGIN
    headline_area_bottom = by - HEADLINE_PHONE_GAP
    headline_font = find_font(108, heavy=True)
    draw_headline(canvas, headline, underline_word, headline_font, headline_area_top, headline_area_bottom)

    canvas.alpha_composite(shadow, (bx - 100, by - 60))
    canvas.alpha_composite(bezel, (bx, by))

    logo = Image.open(LOGO).convert('RGBA')
    lh = 120
    lw = int(logo.width * lh / logo.height)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    brand_font = find_font(72, heavy=True)
    brand_text = 'QuoteCat'
    tb = ImageDraw.Draw(canvas).textbbox((0, 0), brand_text, font=brand_font)
    tw = tb[2] - tb[0]
    th = tb[3] - tb[1]
    gap = 26
    total_w = lw + gap + tw
    brand_cy = (BRAND_AREA_TOP + BRAND_AREA_BOTTOM) // 2
    start_x = (CANVAS_W - total_w) // 2
    logo_y = brand_cy - lh // 2
    text_y = brand_cy - th // 2 - tb[1]
    canvas.alpha_composite(logo, (start_x, logo_y))
    ImageDraw.Draw(canvas).text((start_x + lw + gap, text_y), brand_text, font=brand_font, fill=WHITE)

    out_path = OUT / filename
    canvas.convert('RGB').save(out_path, 'PNG', optimize=True)
    print(f'wrote {out_path.name}')


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    target = sys.argv[1] if len(sys.argv) > 1 else '1'
    if target == 'all':
        for s in SLOTS:
            render(*s)
    else:
        slot_num = int(target)
        slot = next(s for s in SLOTS if s[0] == slot_num)
        render(*slot)


if __name__ == '__main__':
    main()
