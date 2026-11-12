#!/usr/bin/env python3
"""Mux real UE Movie Render Queue PNG frames with user-cleared music.

This will not generate synthetic substitutes for missing UE frames. It requires
an MRQ render receipt and verifies duration/dimensions with ffprobe afterward.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def run(commands: list[str]) -> str:
    process = subprocess.run(commands, capture_output=True, text=True, check=False)
    if process.returncode != 0:
        raise RuntimeError(f"video tool failed with exit code {process.returncode}: {process.stderr[-1500:]}")
    return process.stdout


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--render-inventory", required=True, type=Path)
    p.add_argument("--frames-dir", required=True, type=Path)
    p.add_argument("--music-one", required=True, type=Path)
    p.add_argument("--music-two", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--confirm-music-rights", action="store_true",
                   help="You own or are permitted to use both recordings in this distribution")
    args = p.parse_args()
    if not args.confirm_music_rights:
        p.error("both music tracks require an explicit distribution-rights confirmation")
    if args.output.exists():
        p.error("refusing to overwrite an existing MP4")
    receipt = json.loads(args.render_inventory.read_text(encoding="utf-8"))
    if receipt.get("schema") != "tsm.cinematic.render-evidence.v1":
        p.error("missing genuine UE MRQ frame inventory")
    expected = receipt.get("expected_frames")
    fps = receipt.get("fps")
    resolution = receipt.get("resolution")
    if not isinstance(expected, int) or not isinstance(fps, int) or fps <= 0 or expected / fps < 300:
        p.error("invalid five-minute film inventory")
    if resolution not in ([1920, 1080], [3840, 2160]):
        p.error("invalid expected output resolution")
    frames = sorted(args.frames_dir.glob("frame_*.png"))
    if len(frames) != expected:
        p.error("frame count mismatch (MRQ must export one named PNG per frame)")
    for index, frame in enumerate(frames):
        if frame.name != f"frame_{index:06d}.png" or frame.is_symlink():
            p.error("missing, duplicate or symlinked MRQ frame")
    for track in (args.music_one, args.music_two):
        if not track.is_file() or track.is_symlink():
            p.error("missing or invalid licensed music track")
    duration = expected / fps
    overlap = 8.0
    segment = duration / 2.0 + overlap / 2.0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    graph = (
        f"[1:a]atrim=duration={segment:.3f},asetpts=PTS-STARTPTS,aresample=48000[a1];"
        f"[2:a]atrim=duration={segment:.3f},asetpts=PTS-STARTPTS,aresample=48000[a2];"
        f"[a1][a2]acrossfade=d={overlap:.3f}:c1=tri:c2=tri,"
        f"atrim=duration={duration:.3f}[aout]"
    )
    run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "warning", "-y",
         "-framerate", str(fps), "-start_number", "0",
         "-i", str(args.frames_dir / "frame_%06d.png"),
         "-stream_loop", "-1", "-i", str(args.music_one),
         "-stream_loop", "-1", "-i", str(args.music_two),
         "-filter_complex", graph, "-map", "0:v:0", "-map", "[aout]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "17",
         "-pix_fmt", "yuv420p", "-r", str(fps),
         "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
         "-t", f"{duration:.3f}", "-movflags", "+faststart", str(args.output)])
    data = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
                           "format=duration:stream=codec_type,width,height",
                           "-of", "json", str(args.output)]))
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    measured = float(data["format"]["duration"])
    if not video or not audio or [video.get("width"), video.get("height")] != resolution:
        raise RuntimeError("output movie video/audio/dimension verification failed")
    if abs(measured - duration) > 1.0:
        raise RuntimeError(f"movie duration mismatch {measured:.3f} vs {duration:.3f}")
    filehash = hashlib.sha256()
    with args.output.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            filehash.update(block)
    report = {
        "schema": "tsm.cinematic.film-delivery.v1",
        "source": "VERIFIED_FRAMES_FROM_UE_MRQ_RECEIPT",
        "duration_seconds": measured,
        "resolution": resolution,
        "fps": fps,
        "video_sha256": filehash.hexdigest(),
        "note": "Frame count, output streams and duration validated. Visual GIS fidelity, music distribution rights and engineering/scientific claims require independent review."
    }
    report_path = args.output.with_suffix(".evidence.json")
    if report_path.exists():
        raise RuntimeError("refusing to overwrite film evidence record")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
