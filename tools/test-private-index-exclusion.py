import json
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory() as work:
    root = Path(work)
    for folder in ['daily/20260912', 'daily/20260912/_data/capture', 'daily/20260912/_dividends/prior-published', 'daily/20260912/.private', 'daily/20260912/archive/old']:
        path = root / folder
        path.mkdir(parents=True)
        (path / 'index.html').write_text('<html><title>Fixture</title><p>Content</p></html>')
    for script in ['build_search_index.py', 'build_sitemap_rss.py']:
        subprocess.run([sys.executable, str(TOOLS / script)], cwd=root, check=True)
    documents = json.loads((root / 'assets/search-index.json').read_text())
    assert [row['url'] for row in documents] == ['/daily/20260912/']
    sitemap = (root / 'sitemap.xml').read_text()
    assert '<loc>https://articles.dailytickers.com/daily/20260912/</loc>' in sitemap
    assert all(part not in sitemap for part in ['_data', '_dividends', '.private', 'archive'])
print('Private directory exclusion: PASS (search and sitemap)')
