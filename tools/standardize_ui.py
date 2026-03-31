import os
import re

DIRS = ['analyses', 'daily', 'scanner', 'weekly', 'portfolio']

def standardize():
    count = 0
    for d in DIRS:
        for root, _, files in os.walk(d):
            if 'index.html' in files and 'archive' not in root.split(os.sep):
                filepath = os.path.join(root, 'index.html')
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Fix header link
                original_link_pattern = r'<img src="https://assets\.parqet\.com[^>]*>\s*MARKET WATCH'
                new_link = '<img src="https://articles.dailytickers.com/logo.svg" alt="MW" style="height:28px;"> MARKET WATCH'
                content = re.sub(original_link_pattern, new_link, content)
                
                # Fix another header pattern possibility
                original_title_pattern = r'<img[^>]*logo\.svg[^>]*>\s*MARKET WATCH\s*</a>'
                new_title = '<img src="https://articles.dailytickers.com/logo.svg" alt="MW" style="height:28px;"> MARKET WATCH\n        </a>'
                content = re.sub(original_title_pattern, new_title, content)
                
                # Standardize footer
                footer_pattern = r'<footer[^>]*>.*?</footer>'
                standard_footer = '''<footer style="text-align:center; padding:2rem 0; color:#94a3b8; font-size:0.85rem; border-top: 1px solid #e2e8f0; margin-top: 3rem;">
            <p>&copy; 2026 DailyTickers &mdash; Intelligence Institutionnelle</p>
            <p style="margin-top:1rem;"><a href="/" style="color:#3b82f6; text-decoration: none; font-weight: 600;"><i class="fa-solid fa-house"></i> Retour à l'accueil</a></p>
        </footer>'''
                content = re.sub(footer_pattern, standard_footer, content, flags=re.DOTALL)

                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                count += 1
    
    print(f"Standardized UI elements in {count} index.html files.")

if __name__ == '__main__':
    standardize()
