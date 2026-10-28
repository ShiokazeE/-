"""
Готовит двух персонажей из картинок пользователя (assets/source/*.jpg).

lucy.jpg  — Люси лежит, фон это сцена с неоновыми лучами: вырезать нельзя, поэтому
            делаем «постер» — скруглённые углы и мягкое растворение краёв.
talia.jpg — портрет на ровной фиолетовой заливке: фон убирается заливкой от краёв
            (flood fill), затем чистка каймы и обрезка по содержимому.

Запуск: python tools/make_characters.py
"""

import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, "assets", *p)
SRC = lambda name: os.path.join(ROOT, "assets", "source", name)


def poster(path_in, path_out, width=760, radius_ratio=0.035, fade=0.11):
    img = Image.open(path_in).convert("RGB")
    ratio = width / img.width
    img = img.resize((width, int(img.height * ratio)), Image.LANCZOS)
    w, h = img.size
    r = int(w * radius_ratio)

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)

    fx, fy = max(1, int(w * fade)), max(1, int(h * fade))
    edge = Image.new("L", (w, h), 255)
    ed = ImageDraw.Draw(edge)
    for i in range(fx):
        a = int(255 * (i / fx) ** 1.4)
        ed.line([(i, 0), (i, h)], fill=a)
        ed.line([(w - 1 - i, 0), (w - 1 - i, h)], fill=a)
    for i in range(fy):
        a = int(255 * (i / fy) ** 1.2)
        ed.line([(0, i), (w, i)], fill=a)
        ed.line([(0, h - 1 - i), (w, h - 1 - i)], fill=a)
    edge = edge.filter(ImageFilter.GaussianBlur(w * 0.012))

    out = img.convert("RGBA")
    out.putalpha(ImageChops.multiply(mask, edge))
    out.save(path_out, "PNG", optimize=True)
    out.save(path_out.replace(".png", ".webp"), "WEBP", quality=84, method=6)
    return out.size


def cutout(path_in, path_out, thresh=44, erode=1):
    img = Image.open(path_in).convert("RGB")
    w, h = img.size

    magic = (1, 254, 2)
    probe = img.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
             (w // 4, 0), (3 * w // 4, 0), (0, h // 4), (0, 3 * h // 4),
             (w - 1, h // 4), (w - 1, 3 * h // 4)]
    for xy in seeds:
        try:
            ImageDraw.floodfill(probe, xy, magic, thresh=thresh)
        except Exception:
            pass

    arr = np.asarray(probe)
    removed = np.all(arr == np.array(magic, dtype=arr.dtype), axis=-1)
    alpha = np.where(removed, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")

    if erode:
        alpha_img = alpha_img.filter(ImageFilter.MinFilter(erode * 2 + 1))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.7))

    out = img.convert("RGBA")
    out.putalpha(alpha_img)

    bbox = out.getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)

    # мягкое растворение сверху и снизу: кадр обрезан по груди/макушке
    w2, h2 = out.size
    fade_mask = np.ones((h2, w2), dtype=np.float32)
    top = max(1, int(h2 * 0.06))
    bottom = max(1, int(h2 * 0.16))
    fade_mask[:top, :] *= np.linspace(0.0, 1.0, top, dtype=np.float32)[:, None] ** 0.8
    fade_mask[-bottom:, :] *= np.linspace(1.0, 0.0, bottom, dtype=np.float32)[:, None] ** 1.1

    a = np.asarray(out.getchannel("A")).astype(np.float32) * fade_mask
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))

    # хватает под бокс 268x404 даже на retina
    target_h = 860
    if out.height > target_h:
        scale = target_h / out.height
        out = out.resize((max(1, int(out.width * scale)), target_h), Image.LANCZOS)

    out.save(path_out, "PNG", optimize=True)
    out.save(path_out.replace(".png", ".webp"), "WEBP", quality=84, method=6)
    return out.size


def checker_cutout(path_in, path_out, tones=(233, 191), tol=9, erode=1):
    """Убирает запечённую «шахматку» прозрачности: два серых тона + связность с краем."""
    img = Image.open(path_in).convert("RGB")
    w, h = img.size
    a = np.asarray(img).astype(np.int16)

    # «шахматка» — это нейтральный серый в диапазоне 175..246; антиалиасинг между
    # квадратами тоже попадает в диапазон, поэтому фон становится одной связной областью
    neutral = (np.abs(a[..., 0] - a[..., 1]) <= 9) & (np.abs(a[..., 1] - a[..., 2]) <= 9)
    lum = a[..., 0]
    candidate = neutral & (lum >= 172) & (lum <= 248)

    mask = Image.fromarray((candidate * 255).astype(np.uint8), "L")
    flood = mask.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
             (w // 4, 0), (3 * w // 4, 0), (0, h // 4), (0, 3 * h // 4)]
    for xy in seeds:
        if 0 <= xy[0] < w and 0 <= xy[1] < h and flood.getpixel(xy) == 255:
            ImageDraw.floodfill(flood, xy, 128, thresh=0)

    bg = np.asarray(flood) == 128
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")
    if erode:
        alpha_img = alpha_img.filter(ImageFilter.MinFilter(erode * 2 + 1))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.7))

    out = img.convert("RGBA")
    out.putalpha(alpha_img)

    bbox = out.getbbox()
    if bbox:
        pad = 4
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)

    target = 900
    if out.width > target:
        out = out.resize((target, max(1, int(out.height * target / out.width))), Image.LANCZOS)

    out.save(path_out, "PNG", optimize=True)
    out.save(path_out.replace(".png", ".webp"), "WEBP", quality=86, method=6)
    return out.size


def white_cutout(path_in, path_out, tol=22, erode=2, upscale=2):
    """Убирает белый фон (заливка от краёв), апскейлит и сохраняет."""
    img = Image.open(path_in).convert("RGB")
    w, h = img.size

    magic = (1, 254, 2)
    probe = img.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
             (w // 4, 0), (3 * w // 4, 0), (0, h // 4), (0, 3 * h // 4),
             (w - 1, h // 4), (w - 1, 3 * h // 4)]
    for xy in seeds:
        try:
            ImageDraw.floodfill(probe, xy, magic, thresh=tol)
        except Exception:
            pass

    arr = np.asarray(probe)
    removed = np.all(arr == np.array(magic, dtype=arr.dtype), axis=-1)
    alpha = np.where(removed, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")

    if erode:
        alpha_img = alpha_img.filter(ImageFilter.MinFilter(erode * 2 + 1))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.6))

    out = img.convert("RGBA")
    out.putalpha(alpha_img)

    # де-фринг: по краю убираем примесь белого фона
    arr = np.asarray(out).astype(np.float32)
    a = arr[..., 3:4] / 255.0
    edge = (a > 0.02) & (a < 0.98)
    safe = np.clip(a, 0.05, 1.0)
    rgb = (arr[..., :3] - (1.0 - safe) * 255.0) / safe
    arr[..., :3] = np.where(edge, np.clip(rgb, 0, 255), arr[..., :3])
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")

    bbox = out.getbbox()
    if bbox:
        pad = 3
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)

    if upscale > 1:
        out = out.resize((out.width * upscale, out.height * upscale), Image.LANCZOS)

    out.save(path_out, "PNG", optimize=True)
    out.save(path_out.replace(".png", ".webp"), "WEBP", quality=86, method=6)
    return out.size


def main():
    lucy_png = SRC("lucy.png")
    lucy_jpg = SRC("lucy.jpg")
    talia = SRC("talia.jpg")

    if os.path.exists(lucy_png):
        print("lucy checker cutout:", checker_cutout(lucy_png, A("lucy.png")))
    elif os.path.exists(lucy_jpg):
        print("lucy white cutout:", white_cutout(lucy_jpg, A("lucy.png")))
    if os.path.exists(talia):
        print("talia cutout:", cutout(talia, A("talia.png")))


if __name__ == "__main__":
    main()
