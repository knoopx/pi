---
name: transcribe-audio
description: Transcribes audio files to text using whisper-cpp (local, offline). Use when converting speech to text, transcribing podcasts, lectures, meetings, or any audio content.
---

# transcribe-audio

Transcribes audio files to text using whisper-cpp locally and offline. No API keys or network required.

## Basic Transcription

```bash
transcribe-audio input.mp3                    # Transcribe with default settings
transcribe-audio input.wav --language en      # Specify language
transcribe-audio input.flac --model medium    # Use a larger model for better accuracy
```

## Options

- `--language <code>` — specify source language (auto-detect by default)
- `--model <size>` — choose model size: `tiny`, `base`, `small`, `medium`, `large`
- `--output <format>` — output format: `txt`, `srt`, `vtt` (default: `txt`)
- `--timestamp` — include timestamps in output

## Supported Formats

MP3, WAV, FLAC, OGG, M4A, and any format whisper-cpp supports. For best results, use uncompressed WAV or FLAC.

## Tips

- Larger models (`medium`, `large`) are more accurate but slower
- Auto-detect language works well for common languages; specify explicitly for mixed-language audio
- Output with timestamps is useful for subtitles: `transcribe-audio file.mp4 --output vtt`
- All processing is local — no data leaves your machine
