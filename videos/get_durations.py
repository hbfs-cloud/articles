import os
import subprocess
import json
from pathlib import Path

AUDIO_DIR = Path("se-remettre-dune-perte/audio")
OUTPUT_FILE = "se-remettre-dune-perte/durations.json"

def get_duration(file_path):
    cmd = [
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(file_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return float(result.stdout.strip())

def main():
    durations = {}
    scenes = sorted([f for f in os.listdir(AUDIO_DIR) if f.endswith(".mp3") and f.startswith("scene_")])
    
    for scene in scenes:
        path = AUDIO_DIR / scene
        dur = get_duration(path)
        scene_id = scene.replace(".mp3", "")
        durations[scene_id] = dur
        print(f"{scene_id}: {dur:.2f}s")
        
    with open(OUTPUT_FILE, "w") as f:
        json.dump(durations, f, indent=2)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
