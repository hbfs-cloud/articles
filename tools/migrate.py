import os
import glob
import re
import shutil

# Target directories
DIRS = ['analyses', 'daily', 'scanner', 'weekly', 'portfolio']

def migrate():
    count_rewritten = 0
    count_deleted = 0
    
    # regex to find stylesheet link for report.css
    # It might be href="assets/report.css", href="../../assets/report.css", etc.
    css_pattern = re.compile(r'href="[^"]*assets/report\.css"')
    
    for d in DIRS:
        for root, dirs, files in os.walk(d):
            if 'index.html' in files:
                filepath = os.path.join(root, 'index.html')
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Verify if it has the css pattern
                if css_pattern.search(content):
                    # For scanner, use report-dark.css, else report.css
                    new_css_path = '/assets/report-dark.css' if d == 'scanner' else '/assets/report.css'
                    
                    new_content = css_pattern.sub(f'href="{new_css_path}"', content)
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        count_rewritten += 1

            # Delete local assets/report.css if it exists
            local_report_css = os.path.join(root, 'assets', 'report.css')
            if os.path.exists(local_report_css):
                os.remove(local_report_css)
                count_deleted += 1
                
                # Check if assets dir is now empty, if so, delete it
                assets_dir = os.path.join(root, 'assets')
                if not os.listdir(assets_dir):
                    os.rmdir(assets_dir)

    print(f"Rewrote {count_rewritten} index.html files.")
    print(f"Deleted {count_deleted} local report.css files.")

if __name__ == '__main__':
    migrate()
