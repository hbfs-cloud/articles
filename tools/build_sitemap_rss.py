import os
import glob
from bs4 import BeautifulSoup

def build_sitemap():
    dirs = ['analyses', 'daily', 'scanner', 'weekly', 'portfolio']
    DOMAIN = "https://articles.market-watch.xyz"
    urls = []
    
    for d in dirs:
        for root, _, files in os.walk(d):
            if 'index.html' in files and 'archive' not in root.split(os.sep):
                filepath = os.path.join(root, 'index.html')
                url_path = filepath.replace('index.html', '')
                if not url_path.endswith('/'):
                    url_path += '/'
                # Determine priority based on type
                priority = "0.8"
                if d == "daily" or d == "scanner":
                    priority = "0.7"
                elif d == "weekly":
                    priority = "0.9"
                
                urls.append({
                    "loc": f"{DOMAIN}/{url_path}",
                    "changefreq": "daily",
                    "priority": priority
                })
    
    # Also add the main index
    urls.append({
        "loc": f"{DOMAIN}/",
        "changefreq": "always",
        "priority": "1.0"
    })
    
    sitemap_content = ['<?xml version="1.0" encoding="UTF-8"?>']
    sitemap_content.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for u in urls:
        sitemap_content.append(f'  <url>\n    <loc>{u["loc"]}</loc>\n    <changefreq>{u["changefreq"]}</changefreq>\n    <priority>{u["priority"]}</priority>\n  </url>')
    sitemap_content.append('</urlset>')
    
    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sitemap_content))
    print(f"Built sitemap.xml with {len(urls)} URLs.")

if __name__ == "__main__":
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        pass
    build_sitemap()
