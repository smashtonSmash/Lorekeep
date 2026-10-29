# Procedural, seamless tavern-plank textures (no photos, no AI art). Run: python3 scripts/wood.py
import numpy as np
from PIL import Image, ImageFilter

W, H, PLANK = 640, 512, 128  # horizontal planks, 4 per tile; tile repeats seamlessly both ways
rng = np.random.default_rng(7)

def periodic_noise(h, w, fx, fy, seed):
    """Band-limited noise that wraps on both axes (FFT filtered)."""
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((h, w)))
    ky = np.fft.fftfreq(h)[:, None] * h
    kx = np.fft.fftfreq(w)[None, :] * w
    F *= np.exp(-((kx / fx) ** 2 + (ky / fy) ** 2))
    n = np.real(np.fft.ifft2(F))
    return (n - n.mean()) / n.std()

def make(base, dark, light, seam_col, out, seed):
    y, x = np.mgrid[0:H, 0:W].astype(float)
    img = np.zeros((H, W, 3))
    for p in range(H // PLANK):
        s = seed + p * 11
        band = (y >= p * PLANK) & (y < (p + 1) * PLANK)
        ly = y - p * PLANK
        warp = periodic_noise(H, W, 2, 3, s) * 6 + periodic_noise(H, W, 6, 8, s + 1) * 1.5
        # grain runs along the plank: slow along x, fast across y
        streak = periodic_noise(H, W, 2.5, 55, s + 2)
        fibre = periodic_noise(H, W, 9, 140, s + 3)
        lines = np.sin((ly + warp) * 2 * np.pi / rng.uniform(5.5, 8.5) + streak * 1.2)
        t = .5 + .17 * streak + .08 * fibre + .07 * lines
        # a knot or two, wrapped horizontally
        for _ in range(rng.integers(0, 2) + (p % 2)):
            kx, ky = rng.uniform(0, W), rng.uniform(30, PLANK - 30)
            dx = (x - kx + W / 2) % W - W / 2
            d = np.sqrt((dx / 1.0) ** 2 + ((ly - ky) * 1.9) ** 2)
            t += np.exp(-(d / 10) ** 2) * -.55 + np.sin(d * .55) * np.exp(-(d / 26) ** 2) * .18
        tone = rng.uniform(-.06, .06)  # each plank slightly different
        t = np.clip(t + tone, 0, 1)[..., None]
        col = dark + (light - dark) * t
        # bevel: darker at plank edges, lighter just below the top edge
        edge = np.minimum(ly, PLANK - 1 - ly)[..., None]
        col *= (1 - .55 * np.exp(-edge / 2.2)) * (1 + .06 * np.exp(-((ly - 4) ** 2) / 8))[..., None]
        img[band] = col[band]
        # seam line + iron nails near both ends of the tile repeat
        img[(y == p * PLANK)] = seam_col
        for nx in (W * .12, W * .62):
            ny = p * PLANK + PLANK / 2
            d = np.sqrt((x - nx) ** 2 + (y - ny) ** 2)
            m = d < 4.2
            img[m] = img[m] * .35 + np.array([70, 66, 62]) * .65
            img[(d < 2) & m] = [96, 90, 84]
    img = np.clip(img, 0, 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(.5))
    im.save(out, quality=78, optimize=True, progressive=True)

make(None, np.array([34, 21, 13.]), np.array([92, 60, 36.]), [12, 8, 5], 'src/assets/wood-dark.jpg', 3)
make(None, np.array([160, 118, 74.]), np.array([222, 186, 140.]), [110, 78, 46], 'src/assets/wood-light.jpg', 5)
import os
print({f: os.path.getsize('src/assets/' + f) for f in os.listdir('src/assets')})
