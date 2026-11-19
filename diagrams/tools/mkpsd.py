import sys, json, os
from PIL import Image
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer
from psd_tools.constants import Compression
d, out = sys.argv[1], sys.argv[2]
names = json.load(open(os.path.join(d, 'layers.json')))
full = Image.open(os.path.join(d, '_full.png')).convert('RGBA')
psd = PSDImage.new('RGBA', full.size)
for i, n in enumerate(names):
    im = Image.open(os.path.join(d, f'{i:02d}.png')).convert('RGBA')
    bbox = im.getbbox()
    if not bbox: continue
    crop = im.crop(bbox)
    psd.append(PixelLayer.frompil(crop, psd, n, top=bbox[1], left=bbox[0], compression=Compression.RLE))
psd.save(out)
print('saved', out, full.size, len(names), 'layers')
# recompress the flattened preview with RLE (psd-tools stores it raw by default)
psd = PSDImage.open(out)
rec = psd._record
chans = rec.image_data.get_data(rec.header)
rec.image_data.compression = Compression.RLE
rec.image_data.set_data(chans, rec.header)
psd.save(out)
print('compressed', out, os.path.getsize(out) // 1024, 'KB')
