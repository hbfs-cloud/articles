import os
import re

DIRS = ['tech']

def migrate():
    count_rewritten = 0
    count_deleted = 0
    
    css_pattern = re.compile(r'href="[^"]*assets/report\.css"')
    
    for d in DIRS:
        for root, dirs, files in os.walk(d):
            if 'index.html' in files:
                filepath = os.path.join(root, 'index.html')
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check if it has an assets reference to change
                if css_pattern.search(content):
                    new_content = css_pattern.sub('href="/assets/report.css"', content)
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        count_rewritten += 1

            # Delete local assets/report.css if it exists
            local_report_css = os.path.join(root, 'assets', 'report.css')
            if os.path.exists(local_report_css):
                os.remove(local_report_css)
                count_deleted += 1
                
                assets_dir = os.path.join(root, 'assets')
                if not os.listdir(assets_dir):
                    os.rmdir(assets_dir)

    print(f"Rewrote {count_rewritten} index.html files in tech.")
    print(f"Deleted {count_deleted} local report.css files in tech.")

if __name__ == '__main__':
    migrate()
