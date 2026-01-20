---
name: yt-dlp
description: Download videos and audio from YouTube and thousands of other sites. Use when downloading videos/audio, extracting audio, downloading playlists, or including subtitles/metadata.
---

# yt-dlp Skill

This skill provides common commands for downloading media using `yt-dlp`.

## Basic Usage

```bash
# Download a video (best quality)
yt-dlp "https://www.youtube.com/watch?v=..."

# List available formats
yt-dlp -F "https://www.youtube.com/watch?v=..."

# Download specific format
yt-dlp -f 22 "https://www.youtube.com/watch?v=..."
```

## Common Tasks

### Extracting Audio

```bash
# Extract best quality audio as MP3
yt-dlp -x --audio-format mp3 --audio-quality 0 "URL"

# Extract audio and keep the original video
yt-dlp -x -k "URL"
```

### Video Selection

```bash
# Download best video and best audio separately and merge them
yt-dlp -f "bestvideo+bestaudio" "URL"

# Download video smaller than 50MB
yt-dlp -f "best[filesize<50M]" "URL"
```

### Playlists

```bash
# Download entire playlist
yt-dlp --yes-playlist "URL_TO_PLAYLIST"

# Download only specific items from a playlist
yt-dlp --playlist-items 1,2,5,10-15 "URL"
```

### Metadata and Subtitles

```bash
# Write subtitles to file
yt-dlp --write-subs --sub-langs "en.*" "URL"

# Embed subtitles in video file
yt-dlp --embed-subs "URL"

# Embed metadata and thumbnail
yt-dlp --add-metadata --embed-thumbnail "URL"
```

## Cheat Sheet

### Output Templates

Control the output filename:

```bash
yt-dlp -o "%(title)s.%(ext)s" "URL"
yt-dlp -o "%(uploader)s/%(upload_date)s - %(title)s.%(ext)s" "URL"
```

### Authentication

```bash
# Use browser cookies (handy for age-restricted videos)
yt-dlp --cookies-from-browser chrome "URL"

# Use netrc file
yt-dlp -n "URL"
```

### Useful Options

| Option            | Description                                                  |
| :---------------- | :----------------------------------------------------------- |
| `-U`              | Update yt-dlp.                                               |
| `--list-subs`     | List all available subtitles for the video.                  |
| `--get-filename`  | Print the output filename without downloading.               |
| `--skip-download` | Do not download the video (useful with `--write-info-json`). |
| `--limit-rate 1M` | Limit download speed to 1MB/s.                               |

## Related Tools

- **transcribe**: Convert downloaded media files to text using transcription tools.
