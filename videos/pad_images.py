from PIL import Image, ImageOps
import os

IMAGES_DIR = "se-remettre-dune-perte/images"
TARGET_SIZE = (1920, 1080)
BG_COLOR = (248, 250, 252) # #f8fafc

def pad_images():
    if not os.path.exists(IMAGES_DIR):
        print(f"Directory {IMAGES_DIR} not found.")
        return

    for filename in os.listdir(IMAGES_DIR):
        if filename.endswith(".png"):
            path = os.path.join(IMAGES_DIR, filename)
            try:
                img = Image.open(path)
                
                # Calculate aspect ratios
                target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
                img_ratio = img.width / img.height
                
                if img.size == TARGET_SIZE:
                    print(f"Skipping {filename} (already correct size)")
                    continue
                
                print(f"Processing {filename} ({img.size})...")
                
                # Resize logic: fit within 1920x1080 while maintaining aspect ratio
                # We want the image to be as large as possible within the box
                
                # Scale factor
                scale = min(TARGET_SIZE[0] / img.width, TARGET_SIZE[1] / img.height)
                new_width = int(img.width * scale)
                new_height = int(img.height * scale)
                
                img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Create new background image
                new_img = Image.new("RGB", TARGET_SIZE, BG_COLOR)
                
                # Paste centered
                x = (TARGET_SIZE[0] - new_width) // 2
                y = (TARGET_SIZE[1] - new_height) // 2
                new_img.paste(img_resized, (x, y))
                
                new_img.save(path)
                print(f"  Saved padded {filename}")

            except Exception as e:
                print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    pad_images()
