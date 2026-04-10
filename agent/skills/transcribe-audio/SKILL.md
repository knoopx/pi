---
name: transcribe-audio
description: Transcribes audio files to text using whisper-cpp (local, offline). Use when converting speech to text, transcribing podcasts, lectures, meetings, or any audio content.
---

# Transcribe Audio

Local audio transcription using [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — a C++ port of OpenAI's Whisper.

## Quick Start

```bash
# Transcribe with distil-large-v3 (fast, high quality)
nix run nixpkgs#whisper-cpp -- -m models/ggml-distil-large-v3.bin -f audio.mp3
```

## Model

| Model                      | Size   | Speed   | Quality |
| -------------------------- | ------ | ------- | ------- |
| `ggml-distil-large-v3.bin` | 1.5 GB | ⚡ Fast | Best    |

### Download the Model

```bash
curl -L https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/ggml-distil-large-v3.bin -o ggml-distil-large-v3.bin
```

## Common Options

| Option               | Description                          |
| -------------------- | ------------------------------------ |
| `-m MODEL`           | Model path                           |
| `-f FILE`            | Input audio file                     |
| `-t N`               | Threads (default: 4)                 |
| `-l LANG`            | Language (`en`, `auto`, etc.)        |
| `-otxt`              | Output to `.txt` file                |
| `-osrt`              | Output to `.srt` subtitle file       |
| `-ovtt`              | Output to `.vtt` file                |
| `-oj`                | Output to JSON                       |
| `-of PATH`           | Output file path (without extension) |
| `-nt`                | No timestamps in output              |
| `-np`                | No prints (results only)             |
| `--print-confidence` | Show confidence scores               |

## Examples

### Transcribe with Timestamps (Default)

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f recording.mp3
```

### Save to Text File

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f recording.mp3 -otxt -of transcript
```

### Generate Subtitles

```bash
# First extract audio from video
ffmpeg -i video.mp4 -vn -acodec libmp3lame -ab 128k video.mp3
# Then transcribe
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f video.mp3 -osrt -of captions
```

### JSON Output with Confidence

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f audio.wav -oj -of result --print-confidence
```

### Auto-Detect Language

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f audio.mp3 -l auto
```

### Process Multiple Files

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f file1.mp3 file2.mp3 file3.mp3
```

### Offset and Duration

```bash
# Start at 30s, process 60 seconds
nix run nixpkgs#whisper-cpp -- -m ggml-distil-large-v3.bin -f audio.mp3 -ot 30000 -d 60000
```

## Supported Formats

**Audio:** `flac`, `mp3`, `ogg`, `wav`

**Video:** Extract audio first:

```bash
ffmpeg -i video.mp4 -vn -acodec libmp3lame -ab 128k audio.mp3
```

## GPU Acceleration

For GPU support, use `whisper-cpp-vulkan`:

```bash
nix run nixpkgs#whisper-cpp-vulkan -- -m ggml-distil-large-v3.bin -f audio.mp3
```
