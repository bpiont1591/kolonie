# Generuje zoptymalizowane zasoby graficzne (WebP/PNG) z art-src/ do public/img/.
# Użycie: python3 scripts/build-assets.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, GEN, OUT, PUB = f'{ROOT}/art-src', f'{ROOT}/art-src/gen', f'{ROOT}/public/img', f'{ROOT}/public'
os.makedirs(OUT, exist_ok=True)

def webp(im, name, w, q=72, h=None):
    im = im.convert('RGBA') if im.mode == 'RGBA' else im.convert('RGB')
    if h is None: h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)

def circle_fade(im, inner=0.62, outer=0.98):
    """Miękka okrągła maska – ikony bez kwadratowego tła."""
    im = im.convert('RGB'); w, h = im.size
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    steps = 40
    for i in range(steps):
        r = outer - (outer - inner) * i / steps
        d.ellipse([w/2 - r*w/2, h/2 - r*h/2, w/2 + r*w/2, h/2 + r*h/2], fill=int(255 * (i + 1) / steps))
    out = im.convert('RGBA'); out.putalpha(m); return out

# Key art
hero = Image.open(f'{SRC}/hero.jpg')
hero.convert('RGB').filter(ImageFilter.UnsharpMask(radius=0.8, percent=40, threshold=2)).save(f'{OUT}/hero.webp', 'WEBP', quality=84, method=6)  # źródło 720×1280 – bez skalowania
# Logo z przezroczystym tłem: alfa = jasność, kolor „odmnożony”
logo = Image.open(f'{SRC}/logo.jpg').convert('RGB')
logo = logo.crop((60, 200, 1220, 520))
r, g, b = logo.split()
a = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 0 if v < 14 else min(255, int((v - 14) * 1.9)))
px = logo.load(); ap = a.load(); W, H = logo.size
for y in range(H):
    for x in range(W):
        al = ap[x, y]
        if al:
            rr, gg, bb = px[x, y]; k = 255 / max(al, 1)
            px[x, y] = (min(255, int(rr * k)), min(255, int(gg * k)), min(255, int(bb * k)))
logo.putalpha(a)
webp(logo, 'logo', 1160, 82)
logo.resize((1160 // 2, 320 // 2), Image.LANCZOS)  # sanity

# Ikony / karty
# v8: ostre grafiki na ekranach 2–3× – warianty szerokości do srcset (bez skalowania w górę), WebP q86 + lekkie wyostrzenie
ART_W = [256, 384, 512, 768, 1024]
def sharpen(im, w0):
    k = w0 / im.width  # im.width = docelowa szerokość
    return im.filter(ImageFilter.UnsharpMask(radius=0.8 if k < 1.5 else 1.1, percent=55 if k < 1.5 else 75, threshold=2))
def multi(name, widths=ART_W, q=86, default=768):
    src = Image.open(f'{GEN}/{name}.jpg').convert('RGB')
    for w in widths:
        assert w <= src.width, f'{name}: brak upscalingu ({w} > {src.width})'
        im = src.resize((w, round(src.height * w / src.width)), Image.LANCZOS) if w < src.width else src.copy()
        im = sharpen(im, src.width)
        qq = q if w <= 512 else q - 6  # duże warianty: q80 (ostrość zostaje, plik ~30% mniejszy)
        im.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=qq, method=6)
        if w == default: im.save(f'{OUT}/{name}.webp', 'WEBP', quality=qq, method=6)
SQUARE = ['ship', 'boss', 'cls_szturmowiec', 'cls_krazownik', 'cls_zwiadowca', 'cls_wsparcie', 'b_mine', 'b_power', 'b_shipyard', 'b_lab',
          'p_zwiadowca', 'p_korsarz', 'p_krazownik', 'p_dreadnought', 'p_xeno'] + [f'pl_{i}' for i in range(1, 11)] + [f'cb_{i}' for i in range(1, 11)]
for n in SQUARE: multi(n)
# tła 16:9 – pełna rozdzielczość źródła jako domyślna (CSS background), mniejszy wariant do srcset
for n in ['ev_inwazja', 'ev_lupy', 'ev_happy', 'expedition_bg', 'battle_bg']: multi(n, [640, 1280], 82, 1280)
multi('sector_bg', [576, 1152], 82, 1152)
for n in ['r_metal', 'r_crystal', 'r_energy']:
    im = Image.open(f'{GEN}/{n}.jpg').crop((112, 112, 912, 912))
    webp(circle_fade(im, 0.55, 1.0), n, 128, 84)
# v7: sprite modułów specjalnych (4×3 komórki po 128 px, miękkie okrągłe krawędzie)
sheet = Image.open(f'{GEN}/gear_sheet.jpg').convert('RGB'); cw, chh = sheet.width // 4, sheet.height // 3
sprite = Image.new('RGBA', (4 * 256, 3 * 256), (0, 0, 0, 0))
for i in range(12):
    cx, cy = i % 4, i // 4
    cell = sheet.crop((cx * cw, cy * chh, (cx + 1) * cw, (cy + 1) * chh)).resize((256, 256), Image.LANCZOS)
    sprite.paste(circle_fade(cell, 0.7, 1.0), (cx * 256, cy * 256))
sprite.save(f'{OUT}/gear.webp', 'WEBP', quality=84, method=6)


# Ikony PWA / favicon: planeta z pierścieniem z key artu + litera K z logo
def app_icon(size):
    base = hero.crop((300, 520, 720, 940)).convert('RGB').resize((size, size), Image.LANCZOS)
    base = Image.blend(base, Image.new('RGB', base.size, (4, 8, 22)), 0.25)
    k = logo.crop((30, 0, 252, 320))  # litera K
    kw = int(size * 0.62); kh = int(k.height * kw / k.width)
    k = k.resize((kw, kh), Image.LANCZOS)
    glow = Image.new('RGBA', base.size, (0, 0, 0, 0)); glow.paste(k, ((size - kw) // 2, (size - kh) // 2), k)
    shadow = glow.split()[3].filter(ImageFilter.GaussianBlur(size // 40))
    out = base.convert('RGBA')
    out.paste(Image.new('RGBA', base.size, (62, 230, 255, 255)), (0, 0), shadow.point(lambda v: int(v * 0.5)))
    out.alpha_composite(glow)
    return out.convert('RGB')
for s in (512, 192, 180, 32):
    im = app_icon(512).resize((s, s), Image.LANCZOS)
    (im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG) if s >= 180 else im).save(f'{PUB}/icon-{s}.png', optimize=True)

# Obraz do udostępniania (Open Graph 1200x630)
og = Image.new('RGB', (1200, 630), (5, 9, 24))
bg = hero.crop((0, 470, 720, 848)).resize((1200, 630), Image.LANCZOS)
og.paste(bg)
shade = Image.new('L', (1200, 630)); d = ImageDraw.Draw(shade)
for x in range(1200): d.line([(x, 0), (x, 630)], fill=int(200 * max(0, 1 - x / 760)))
og.paste((5, 9, 24), (0, 0), shade)
lg = logo.resize((640, int(640 * logo.height / logo.width)), Image.LANCZOS)
ogr = og.convert('RGBA'); ogr.alpha_composite(lg, (50, 150)); og = ogr.convert('RGB')
d = ImageDraw.Draw(og)
font = ImageFont.truetype('/usr/share/fonts/truetype/sand-box/google/Rajdhani/Rajdhani-Bold.ttf', 46)
font2 = ImageFont.truetype('/usr/share/fonts/truetype/sand-box/google/Rajdhani/Rajdhani-SemiBold.ttf', 34)
d.text((70, 345), 'Zbuduj kolonię. Podbij galaktykę.', font=font, fill=(235, 242, 255))
d.text((70, 405), 'Darmowa kosmiczna gra MMORPG w przeglądarce', font=font2, fill=(120, 225, 245))
d.rounded_rectangle([70, 470, 370, 535], 14, fill=(255, 128, 48))
d.text((96, 478), 'ZAGRAJ ZA DARMO', font=font2, fill=(20, 10, 4))
og.save(f'{OUT}/og.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
print('done')
