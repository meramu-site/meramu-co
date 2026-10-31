#!/usr/bin/env python3
"""Generate self-hosted image variants for meramu.site articles.

Usage:
    python3 make_img_variants.py <input-image-or-URL> <output-base-name>

Writes into ../public/img/ (relative to this script):
    <base>-500.webp, <base>-800.webp, <base>-1200.webp  (WebP, quality 80)
    <base>-1200.jpg                                      (JPEG, quality 82, og:image)

SOP (Oct 2026): every cover is 16:9, mandatory crop. The input is
center-cropped to 16:9 FIRST (portrait/square sources lose top/bottom,
wide sources lose sides), then resized. The -1200 variant is therefore
1200x675 (or the cropped width if smaller). Ratio 16:9 is the standard;
1920px files are not generated because no template requests more than
1200w and the article figure container is at most 768px wide, so 1920
would only add weight with no visible difference.

Rules:
- Width is capped at the (cropped) original width: never upscale. If the
  cropped image is 1080px wide, the -1200 files contain the 1080px render.
- WebP keeps alpha when present; JPEG composites alpha onto white.
- SVG input is rejected: rasterize first (e.g. via a Wikimedia
  FilePath?width= PNG render) and pass the PNG instead.
- Existing files are overwritten only for the same base name; nothing else
  in public/ is touched.

Future-publish workflow: run this script, then set the article imageUrl to
    https://meramu.site/img/<base>.webp
(caption unchanged; og:image auto-derives to the -1200.jpg variant).
"""
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.normpath(os.path.join(HERE, '..', 'public', 'img'))

SIZES_WEBP = (500, 800, 1200)


def sanitize(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    s = re.sub(r'-(500|800|1200)$', '', s)  # never stack a size suffix
    return s or 'image'


def load_input(src):
    """Return a local file path for a local path or http(s) URL."""
    if src.startswith('http://') or src.startswith('https://'):
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.bin')
        tmp.close()
        r = subprocess.run(['curl', '-sL', '--fail', '-A', 'Mozilla/5.0 (MeramuMigration/1.0; meramu.site)',
                            '-o', tmp.name, src], capture_output=True, text=True, timeout=180)
        if r.returncode != 0 or os.path.getsize(tmp.name) == 0:
            raise SystemExit(f'ERROR: failed to download {src}')
        return tmp.name
    if not os.path.exists(src):
        raise SystemExit(f'ERROR: input not found: {src}')
    return src


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    from PIL import Image
    src, base = load_input(sys.argv[1]), sanitize(sys.argv[2])
    if src.lower().endswith('.svg'):
        raise SystemExit('ERROR: SVG input is not supported; pass a PNG render instead '
                         '(e.g. a Wikimedia FilePath?width= URL).')
    try:
        im = Image.open(src)
        im.load()
    except Exception as e:
        raise SystemExit(f'ERROR: cannot open image {src}: {e}')
    if im.format == 'SVG':
        raise SystemExit('ERROR: SVG input is not supported; pass a PNG render instead.')
    ow, oh = im.size
    print(f'original: {im.format} {ow}x{oh}')
    # SOP: mandatory 16:9 center-crop before any resize, so file and figure
    # box agree (figure CSS is aspect-ratio:16/9 + object-fit:cover).
    if ow * 9 != oh * 16:
        if ow / oh > 16 / 9:
            nw = round(oh * 16 / 9)
            x0 = (ow - nw) // 2
            im = im.crop((x0, 0, x0 + nw, oh))
        else:
            nh = round(ow * 9 / 16)
            y0 = (oh - nh) // 2
            im = im.crop((0, y0, ow, y0 + nh))
        ow, oh = im.size
        print(f'cropped to 16:9: {ow}x{oh}')
    os.makedirs(OUTDIR, exist_ok=True)

    # WebP variants (keep alpha when present; normalize palette/CMYK).
    webp_im = im
    if webp_im.mode in ('P', 'CMYK', 'LA', 'PA'):
        webp_im = webp_im.convert('RGBA' if 'transparency' in webp_im.info else 'RGB')
    elif webp_im.mode not in ('RGB', 'RGBA'):
        webp_im = webp_im.convert('RGB')
    for target in SIZES_WEBP:
        w = min(target, ow)
        h = max(1, round(oh * w / ow))
        r = webp_im.resize((w, h), Image.LANCZOS)
        out = os.path.join(OUTDIR, f'{base}-{target}.webp')
        r.save(out, 'WEBP', quality=80)
        print(f'{os.path.basename(out)}: {w}x{h} {os.path.getsize(out)}B')

    # JPEG og:image variant (RGB, alpha composited onto white).
    jw = min(1200, ow)
    jh = max(1, round(oh * jw / ow))
    rgb = im.resize((jw, jh), Image.LANCZOS)
    if rgb.mode in ('RGBA', 'LA', 'PA') or (rgb.mode == 'P' and 'transparency' in rgb.info):
        bg = Image.new('RGB', rgb.size, (255, 255, 255))
        alpha = rgb.convert('RGBA').split()[-1]
        bg.paste(rgb.convert('RGBA'), mask=alpha)
        rgb = bg
    elif rgb.mode != 'RGB':
        rgb = rgb.convert('RGB')
    out = os.path.join(OUTDIR, f'{base}-1200.jpg')
    rgb.save(out, 'JPEG', quality=82)
    print(f'{os.path.basename(out)}: {jw}x{jh} {os.path.getsize(out)}B')


if __name__ == '__main__':
    main()
