"""Copy matching product images from the optional Items archive."""
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/prepare_images.py PATH_TO_ITEMS_ZIP')
items = json.loads((root / 'data/dashboard.json').read_text(encoding='utf-8'))['items']
destination = root / 'assets/items'
destination.mkdir(parents=True, exist_ok=True)

def normalize(name):
    name = unicodedata.normalize('NFC', name).lower().replace('ё', 'е')
    # The teaching dataset renames the brand; product variants remain distinct.
    name = name.replace('из груши', 'из лавки').replace('x груша', 'x лавка')
    return re.sub(r'[^a-zа-я0-9]', '', name)

def decode_filename(name):
    try:
        return name.encode('cp437').decode('utf-8')
    except UnicodeError:
        return name

mapping = []
with zipfile.ZipFile(sys.argv[1]) as archive:
    lookup = {}
    for entry in archive.infolist():
        if not entry.filename.startswith('items/') or not entry.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        filename = Path(decode_filename(entry.filename))
        name = filename.stem.split('_', 1)[1].replace('_', ' ')
        lookup.setdefault(normalize(name), []).append((entry, filename.name))
    for product in items:
        candidates = lookup.get(normalize(product['name']), [])
        if not candidates:
            raise ValueError(f"No exact image match: {product['name']}")
        hashes = {hashlib.sha256(archive.read(entry)).hexdigest() for entry, _ in candidates}
        if len(hashes) != 1:
            raise ValueError(f"Ambiguous image match: {product['name']}")
        entry, source_name = sorted(candidates, key=lambda pair: pair[1])[0]
        image_name = product['id'] + Path(source_name).suffix.lower()
        (destination / image_name).write_bytes(archive.read(entry))
        mapping.append({'id': product['id'], 'sourceImage': source_name, 'file': image_name})
(root / 'data/image-sources.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'matchedProducts': len(mapping), 'imageBytes': sum((destination / row['file']).stat().st_size for row in mapping)}))
