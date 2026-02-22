import os
import re
import sys

def fix_html_encoding(directory):
    print(f"Scanning directory: {directory}")
    files_fixed = 0
    
    # Regex 1: Surrogate Pairs (High: D800-DBFF, Low: DC00-DFFF)
    # \\uD8xx \\uDCxx
    regex_pair = re.compile(r'\\u([dD][89abAB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})')
    
    def replace_pair(match):
        high = int(match.group(1), 16)
        low = int(match.group(2), 16)
        # Calculate code point from surrogate pair
        code_point = 0x10000 + (high - 0xD800) * 0x400 + (low - 0xDC00)
        return chr(code_point)

    # Regex 2: Standard \uXXXX (non-surrogate or lone if any)
    regex_single = re.compile(r'\\u([0-9a-fA-F]{4})')
    
    def replace_single(match):
        code_point = int(match.group(1), 16)
        return chr(code_point)

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if '\\u' in content:
                        # 1. Fix pairs first (to form Emojis etc)
                        temp_content = regex_pair.sub(replace_pair, content)
                        
                        # 2. Fix remaining singles
                        new_content = regex_single.sub(replace_single, temp_content)
                        
                        # Only write if changed
                        if new_content != content:
                            print(f"Fixing encoding in: {filepath}")
                            with open(filepath, 'w', encoding='utf-8') as f:
                                f.write(new_content)
                            files_fixed += 1
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
                    import traceback
                    traceback.print_exc()
                    
    print(f"Total files fixed: {files_fixed}")

if __name__ == "__main__":
    target_dir = os.getcwd()
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    
    fix_html_encoding(target_dir)
