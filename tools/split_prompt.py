import os
import re

def split_prompt():
    if not os.path.exists('PROMPT.md'):
        print("PROMPT.md not found")
        return
        
    with open('PROMPT.md', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find all ## headers and their content
    headers = re.split(r'(^##\s+.*?$)', content, flags=re.MULTILINE)
    
    # Define mapping from header prefix to folder
    mapping = {
        "1. RAPPORT HEBDOMADAIRE": "weekly",
        "2. ANALYSE INDIVIDUELLE": "analyses",
        "2bis. BRIEFING QUOTIDIEN": "daily",
        "5. SCANNER QUOTIDIEN": "scanner",
        "5bis. RÉTROSPECTIVE SCANNER HEBDOMADAIRE": "scanner",
        "6. PORTFOLIO": "portfolio",
        "8. LAB": "lab-src",
    }
    
    chunks_by_folder = {}
        
    for i in range(1, len(headers), 2):
        header_text = headers[i].strip()
        body_text = headers[i+1]
        
        folder = None
        for key in mapping:
            if key in header_text:
                folder = mapping[key]
                break
                
        if folder:
            if folder not in chunks_by_folder:
                chunks_by_folder[folder] = []
            chunks_by_folder[folder].append(header_text + "\n" + body_text)
            
    # Write the chunks to the respective CLAUDE.md files
    for folder, texts in chunks_by_folder.items():
        if os.path.exists(folder):
            filepath = os.path.join(folder, 'CLAUDE.md')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# DailyTickers - {folder.capitalize()} Instructions\n\n")
                f.write("".join(texts))
            print(f"Created {filepath}")

if __name__ == '__main__':
    split_prompt()
