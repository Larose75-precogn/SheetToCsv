#!/usr/bin/env python3
"""Génère les icônes officielles SheetToCsv (PNG carrés, fond transparent).

Tailles exigées par Google Workspace Marketplace :
  - 128x128 et 32x32 (obligatoires)
  - 96x96 et 48x48 (obligatoires car l'application inclut une web app)

Usage : python3 tools/make_icons.py
Sortie : assets/icons/sheettocsv-<taille>.png
"""

import os
from PIL import Image, ImageDraw

SS = 8                      # facteur de suréchantillonnage (anti-aliasing)
BASE = 128 * SS             # canevas de travail
SIZES = (128, 96, 48, 32)
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

AMBER_TOP = (255, 165, 32)  # #FFA520
AMBER_BOT = (240, 140, 0)   # #F08C00
WHITE = (255, 255, 255, 255)


def gradient_tile(size, radius):
    """Tuile carrée à coins arrondis, dégradé vertical, extérieur transparent."""
    grad = Image.new('RGB', (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        grad.putpixel((0, y), tuple(
            round(AMBER_TOP[i] + (AMBER_BOT[i] - AMBER_TOP[i]) * t) for i in range(3)
        ))
    grad = grad.resize((size, size))

    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius, fill=255)

    tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tile.paste(grad, (0, 0), mask)
    return tile


def build_master():
    img = gradient_tile(BASE, int(BASE * 0.22))
    d = ImageDraw.Draw(img)
    u = BASE / 128.0  # unité = 1 px à la taille 128

    # Feuille de calcul blanche
    doc_l, doc_t, doc_r, doc_b = 30 * u, 24 * u, 98 * u, 104 * u
    d.rounded_rectangle([doc_l, doc_t, doc_r, doc_b], radius=7 * u, fill=WHITE)

    # Lignes du tableau (ambre) : un en-tête plein + deux lignes de données
    line_x0, line_x1 = doc_l + 10 * u, doc_r - 10 * u
    d.rounded_rectangle(
        [line_x0, doc_t + 12 * u, line_x1, doc_t + 21 * u],
        radius=2 * u, fill=(245, 158, 11, 255)
    )
    for i in range(2):
        y = doc_t + 30 * u + i * 13 * u
        d.rounded_rectangle(
            [line_x0, y, line_x1, y + 7 * u],
            radius=2 * u, fill=(253, 200, 120, 255)
        )

    # Flèche d'export vers le bas, en ambre foncé sur pastille blanche
    cx, cy, r = 92 * u, 92 * u, 24 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    shaft_w = 7 * u
    d.rounded_rectangle(
        [cx - shaft_w, cy - 14 * u, cx + shaft_w, cy + 3 * u],
        radius=shaft_w, fill=AMBER_BOT
    )
    d.polygon(
        [(cx - 13 * u, cy - 1 * u), (cx + 13 * u, cy - 1 * u), (cx, cy + 14 * u)],
        fill=AMBER_BOT
    )
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    master = build_master()
    for size in SIZES:
        icon = master.resize((size, size), Image.LANCZOS)
        path = os.path.abspath(os.path.join(OUT_DIR, 'sheettocsv-%d.png' % size))
        icon.save(path, 'PNG', optimize=True)
        print('%s  %dx%d  RGBA' % (path, size, size))


if __name__ == '__main__':
    main()
