---
name: transcribe-audio
description: Transcribes audio files to text using whisper-cpp (local, offline). Use when converting speech to text, transcribing podcasts, lectures, meetings, or any audio content.
---

# Transcribe Audio

Local audio transcription using [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — a C++ port of OpenAI's Whisper.

## Quick Start

```bash
# Transcribe with a small model (fast, ~75MB)
nix run nixpkgs#whisper-cpp -- -m models/ggml-tiny.en.bin -f audio.mp3
```

## Available Models

| Model                | Size   | Speed      | Quality |
| -------------------- | ------ | ---------- | ------- |
| `ggml-tiny.en.bin`   | 75 MB  | ⚡ Fastest | Basic   |
| `ggml-base.en.bin`   | 142 MB | ⚡ Fast    | Good    |
| `ggml-small.en.bin`  | 468 MB | 🐌 Medium  | Better  |
| `ggml-medium.en.bin` | 1.4 GB | 🐌 Slower  | Good    |
| `ggml-large-v3.bin`  | 3.1 GB | 🐌🐌 Slow  | Best    |

### Download a Model

```bash
# Example: download base model
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin -o ggml-base.en.bin
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
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f recording.mp3
```

### Save to Text File

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f recording.mp3 -otxt -of transcript
```

### Generate Subtitles

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f video.mp4 -osrt -of captions
```

### JSON Output with Confidence

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f audio.wav -oj -of result --print-confidence
```

### Auto-Detect Language

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-base.bin -f audio.mp3 -l auto
```

### Process Multiple Files

```bash
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f file1.mp3 file2.mp3 file3.mp3
```

### Offset and Duration

```bash
# Start at 30s, process 60 seconds
nix run nixpkgs#whisper-cpp -- -m ggml-base.en.bin -f audio.mp3 -ot 30000 -d 60000
```

## Supported Formats

`flac`, `mp3`, `ogg`, `wav`

## GPU Acceleration

For GPU support, use `whisper-cpp-vulkan`:

```bash
nix run nixpkgs#whisper-cpp-vulkan -- -m ggml-base.en.bin -f audio.mp3
```
