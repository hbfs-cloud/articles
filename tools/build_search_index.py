import os
import json
import re
from html.parser import HTMLParser

class SimpleHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag.lower() == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title = data.strip()
        else:
            txt = data.strip()
            if txt:
                self.text.append(txt)

def build_index():
    dirs = ['analyses', 'daily', 'scanner', 'weekly', 'portfolio']
    index = []
    
    for d in dirs:
        for root, _, files in os.walk(d):
            if 'index.html' in files and 'archive' not in root.split(os.sep):
                filepath = os.path.join(root, 'index.html')
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                parser = SimpleHTMLParser()
                parser.feed(content)
                text_content = ' '.join(parser.text)
                
                # Try to extract ticker from path
                ticker = ""
                if d == 'analyses':
                    parts = root.split(os.sep)
                    if len(parts) >= 2:
                        ticker = parts[1]
                
                # Make path relative to root
                url_path = filepath.replace('index.html', '')
                if not url_path.endswith('/'):
                    url_path += '/'
                
                index.append({
                    "url": f"/{url_path}",
                    "title": parser.title,
                    "ticker": ticker,
                    "content": text_content[:5000] # Limit content for index size
                })
                
    os.makedirs('assets', exist_ok=True)
    with open('assets/search-index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False)
    print(f"Built search index with {len(index)} documents.")

if __name__ == "__main__":
    build_index()
