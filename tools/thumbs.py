"""Create 720px thumbnails in thumbs/ for any images/ file missing one."""
import glob, os
from PIL import Image, ImageOps
for f in glob.glob('images/*/*.jpg') + glob.glob('images/*/*.png') + glob.glob('images/*/*.webp'):
    out = 'thumbs/' + f[len('images/'):]
    if os.path.exists(out): continue
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB'); im.thumbnail((720, 720))
    im.save(out, quality=78, optimize=True, progressive=True); print(out)
