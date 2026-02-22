#!/usr/bin/env python3
"""
Market Watch Video Pipeline (2026 Edition)
Automated generation of scrolling video, audio, thumbnail, and metadata.

Usage:
  python3 generate_video.py --slug se-remettre-dune-perte --lang fr --level expert
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from record_video import run_recorder, run_thumbnail

# ---------------------------------------------------------------------------
# Config & Constants
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.resolve()
ARTICLES_DIR = BASE_DIR.parent / "series"

def get_audio_duration(path: str) -> float:
    """Get audio duration in seconds via ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", path],
            capture_output=True, text=True, check=True
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0

# ---------------------------------------------------------------------------
# Stage 1: Audio (Edge TTS)
# ---------------------------------------------------------------------------
async def generate_audio(script: dict, audio_dir: Path) -> list[float]:
    """Generate audio files using Edge TTS."""
    import edge_tts

    print("\n[Stage 1] Generating Audio...")
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    voice = script.get("voice", "fr-FR-RemyMultilingualNeural")
    rate = script.get("voice_rate", "-5%")
    durations = []
    concat_list_path = audio_dir / "concat_list.txt"
    concat_content = ""

    for scene in script["scenes"]:
        scene_id = scene["id"]
        mp3_path = audio_dir / f"{scene_id}.mp3"
        text = scene.get("narration", "").strip()

        if not text:
            # Silence for title/end cards
            dur = scene.get("duration_override", 5.0)
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                "-t", str(dur), "-c:a", "libmp3lame", "-b:a", "128k", str(mp3_path)
            ], capture_output=True)
            print(f"  [Silence] {scene_id}: {dur}s")
        else:
            # Generate TTS
            if not mp3_path.exists(): # Simple cache
                comm = edge_tts.Communicate(text, voice, rate=rate)
                await comm.save(str(mp3_path))
            dur = get_audio_duration(str(mp3_path))
            print(f"  [TTS]     {scene_id}: {dur:.2f}s")

        durations.append(dur)
        concat_content += f"file '{scene_id}.mp3'\n"

    # Save concat list
    with open(concat_list_path, "w") as f:
        f.write(concat_content)

    # Concatenate full audio
    full_audio = audio_dir / "full_narration.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list_path), "-c", "copy", str(full_audio)
    ], capture_output=True)
    
    print(f"  [Done] Full audio duration: {sum(durations):.2f}s")
    return durations

# ---------------------------------------------------------------------------
# Stage 2: Video Recording (Playwright)
# ---------------------------------------------------------------------------
def generate_video_track(script: dict, output_dir: Path, html_path: Path, durations: list) -> str:
    """Record the scrolling video."""
    print("\n[Stage 2] Recording Video Track...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    video_path = run_recorder(str(html_path), str(output_dir), script["scenes"], durations)
    print(f"  [Done] Raw video recorded: {video_path}")
    return video_path

# ---------------------------------------------------------------------------
# Stage 3: Assembly (FFmpeg)
# ---------------------------------------------------------------------------
def assemble_final_cut(video_path: str, audio_path: str, output_path: str):
    """Mux audio and video, adjusting video speed to match audio."""
    print("\n[Stage 3] Assembling Final Cut...")
    
    vid_dur = get_audio_duration(video_path) # It works for video containers too
    aud_dur = get_audio_duration(audio_path)
    
    if vid_dur == 0:
        print("Error: Invalid video duration")
        return

    # Calculate speed factor to stretch/shrink video to match audio
    # factor > 1 means slow down (presentation timestamp increases)
    # factor < 1 means speed up
    speed_factor = aud_dur / vid_dur
    print(f"  Video: {vid_dur:.2f}s | Audio: {aud_dur:.2f}s | Speed Factor: {speed_factor:.3f}")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex", f"[0:v]setpts={speed_factor:.4f}*PTS[v]",
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "slow", "-crf", "21",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_path
    ]
    
    # Run quietly but show errors
    subprocess.run(cmd, check=True, stderr=subprocess.PIPE)
    print(f"  [Success] Final video: {output_path}")

# ---------------------------------------------------------------------------
# Stage 4: Metadata & Thumbnail
# ---------------------------------------------------------------------------
def generate_metadata(script: dict, output_dir: Path, html_path: Path):
    """Generate YouTube metadata and Thumbnail."""
    print("\n[Stage 4] Generating Extras...")
    
    # 1. Thumbnail
    run_thumbnail(str(html_path), str(output_dir))
    
    # 2. Metadata File
    meta_path = output_dir / "youtube_metadata.md"
    title = script['title']
    desc = f"""
{title} | Market Watch

Dans cette vidéo, nous explorons : {script['title']}.
Une analyse détaillée pour les investisseurs {script.get('level', 'experts')}.

Chapitres :
"""
    # Generate chapters
    timestamp = 0.0
    for scene in script['scenes']:
        scene_dur = scene.get('duration_override', 0) 
        # Note: accurate timestamps require actual TTS durations, simpler to just list topics here
        # or we could use the durations list passed in.
        # For now, just a list of topics.
        if scene['type'] == 'narration':
             # Extract first sentence or use ID
             topic = scene['narration'].split('.')[0]
             desc += f"- {topic}\n"
    
    desc += "\n\nRetrouvez l'article complet sur : https://market-watch.xyz"
    
    with open(meta_path, "w") as f:
        f.write(f"# TITRE\n{title}\n\n# DESCRIPTION\n{desc}\n\n# TAGS\nBourse, Finance, Investissement, Market Watch")
    
    print(f"  [Done] Metadata saved to {meta_path}")

# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Generate Market Watch Video")
    parser.add_argument("--slug", required=True, help="Article slug (e.g. se-remettre-dune-perte)")
    parser.add_argument("--lang", default="fr", help="Language (fr/en)")
    parser.add_argument("--level", default="expert", help="Level (beginner/expert)")
    args = parser.parse_args()

    # Paths
    project_dir = BASE_DIR / args.slug
    script_path = project_dir / "script.json"
    
    # Determine HTML path
    # Standard structure: series/{slug}/index.html (Expert FR default) or series/{slug}/{level}/{lang}/index.html
    # But usually 'expert' implies the root index.html for legacy reasons, or specific subfolders.
    # We check:
    # 1. series/{slug}/{level}/{lang}/index.html
    # 2. series/{slug}/index.html (fallback)
    
    html_candidate = ARTICLES_DIR / args.slug / args.level / args.lang / "index.html"
    if not html_candidate.exists():
        # Fallback for 'expert fr' which is often at root
        if args.level == "expert" and args.lang == "fr":
            html_candidate = ARTICLES_DIR / args.slug / "index.html"
    
    if not html_candidate.exists():
        print(f"Error: HTML source not found at {html_candidate}")
        sys.exit(1)
        
    print(f"Target Article: {html_candidate}")

    if not script_path.exists():
        print(f"Error: Script not found at {script_path}")
        print("Please ensure script.json exists with 'focus_selector' fields.")
        sys.exit(1)

    with open(script_path) as f:
        script = json.load(f)

    # Output Dirs
    output_dir = project_dir / "output"
    audio_dir = project_dir / "audio"
    
    # 1. Audio
    durations = asyncio.run(generate_audio(script, audio_dir))
    
    # 2. Video (Raw)
    raw_video = generate_video_track(script, output_dir, html_candidate, durations)
    
    # 3. Assembly
    final_output = output_dir / f"{args.slug}.mp4"
    full_audio = audio_dir / "full_narration.mp3"
    assemble_final_cut(raw_video, str(full_audio), str(final_output))
    
    # 4. Metadata & Thumbnail
    generate_metadata(script, output_dir, html_candidate)

    print("\n" + "="*60)
    print("PIPELINE COMPLETED SUCCESSFULLY")
    print(f"Video: {final_output}")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()