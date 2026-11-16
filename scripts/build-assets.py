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
webp(hero, 'hero', 720, 70)
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
webp(logo, 'logo', 640, 74)
logo.resize((1160 // 2, 320 // 2), Image.LANCZOS)  # sanity

# Ikony / karty
for n in ['ship']: webp(Image.open(f'{GEN}/{n}.jpg'), n, 512, 72)
for n in ['cls_szturmowiec', 'cls_krazownik', 'cls_zwiadowca', 'cls_wsparcie']: webp(Image.open(f'{GEN}/{n}.jpg'), n, 400, 70)
for i in range(1, 6): webp(Image.open(f'{GEN}/pl_{i}.jpg'), f'pl_{i}', 360, 68); webp(Image.open(f'{GEN}/cb_{i}.jpg'), f'cb_{i}', 400, 70)
for n in ['b_mine', 'b_power', 'b_shipyard', 'b_lab']: webp(Image.open(f'{GEN}/{n}.jpg'), n, 320, 70)
for n in ['p_zwiadowca', 'p_korsarz', 'p_krazownik', 'p_dreadnought']: webp(Image.open(f'{GEN}/{n}.jpg'), n, 320, 70)
for n in ['r_metal', 'r_crystal', 'r_energy']:
    im = Image.open(f'{GEN}/{n}.jpg').crop((112, 112, 912, 912))
    webp(circle_fade(im, 0.55, 1.0), n, 128, 80)
bb = Image.open(f'{GEN}/battle_bg.jpg'); bb = bb.crop((0, 80, bb.width, 652))
webp(bb, 'battle_bg', 1100, 66)

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
