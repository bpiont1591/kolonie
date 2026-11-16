# Wycina tło (czarne) z ikon w art-src/icons/*.jpg -> public/img/i_<nazwa>.webp (przezroczyste, 160 px).
import os, glob
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = f'{ROOT}/art-src/icons', f'{ROOT}/public/img'
T = 42.0  # próg jasności tła
for f in sorted(glob.glob(f'{SRC}/*.jpg')):
    name = os.path.splitext(os.path.basename(f))[0]
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    lum = im.max(axis=2)
    dark = lum < T
    lab, _ = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, np.clip((lum - 6) / (T - 6), 0, 1), 1.0)
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    rgb = np.where(bg[..., None], im / np.maximum(alpha[..., None], 1e-3), im)
    rgb = np.clip(rgb, 0, 255)
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    bbox = out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    out = out.crop(bbox)
    w, h = out.size; s = max(w, h); pad = int(s * 0.04); S = s + 2 * pad
    sq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sq.paste(out, ((S - w) // 2, (S - h) // 2))
    sq.resize((160, 160), Image.LANCZOS).save(f'{OUT}/i_{name}.webp', 'WEBP', quality=84, method=6)
    print(name, os.path.getsize(f'{OUT}/i_{name}.webp'))
