---
name: yt-dlp
description: Download videos and audio, extract audio tracks, fetch playlists, and embed subtitles/metadata using yt-dlp. Use when saving media from YouTube or other sites, converting formats, or archiving content.
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

## Advanced Usage

### Format Selection

```bash
# Best video + best audio
yt-dlp -f "bestvideo+bestaudio" "URL"

# Best video with height ≤ 720
yt-dlp -f "bestvideo[height<=720]+bestaudio" "URL"

# Specific format by ID
yt-dlp -f "137+140" "URL"

# Audio only in specific format
yt-dlp -f "bestaudio[ext=m4a]" "URL"
```

### Output Templates

```bash
# Custom filename template
yt-dlp -o "%(title)s - %(uploader)s.%(ext)s" "URL"

# Organize by uploader
yt-dlp -o "%(uploader)s/%(title)s.%(ext)s" "URL"

# Include upload date
yt-dlp -o "%(upload_date>%Y-%m-%d)s - %(title)s.%(ext)s" "URL"
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

## Post-Processing

### Video Conversion

```bash
# Remux to different container
yt-dlp --remux-video mp4 "URL"

# Re-encode video
yt-dlp --recode-video mp4 "URL"

# Split by chapters
yt-dlp --split-chapters "URL"
```

### SponsorBlock Integration

```bash
# Remove sponsor segments
yt-dlp --sponsorblock-remove sponsor "URL"

# Mark sponsor segments as chapters
yt-dlp --sponsorblock-mark sponsor "URL"
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

| Option | Description |
| :----- | :---------- |
| `-U` | Update yt-dlp |
| `--list-subs` | List available subtitles |
| `--get-filename` | Print output filename without downloading |
| `--skip-download` | Process but don't download |
| `--limit-rate 1M` | Limit download speed to 1MB/s |
| `--playlist-random` | Download playlist in random order |
| `--no-overwrites` | Don't overwrite existing files |
| `--continue` | Resume partial downloads |
| `--ignore-errors` | Continue on download errors |
| `--verbose` | More detailed output |
| `--write-description` | Save video description |
| `--write-info-json` | Save metadata as JSON |
| `--download-archive FILE` | Skip already downloaded videos |

### Format Selection Examples

```bash
# Best quality MP4
-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]"

# Audio only
-f "bestaudio"

# Video under 1080p
-f "bestvideo[height<=1080]+bestaudio/best[height<=1080]"

# Specific codec
-f "bestvideo[vcodec^=avc]+bestaudio"
```

### Output Template Fields

Common fields for `-o` template:

- `%(title)s` - Video title
- `%(uploader)s` - Channel/uploader name
- `%(upload_date)s` - Upload date (YYYYMMDD)
- `%(duration)s` - Duration in seconds
- `%(view_count)s` - View count
- `%(id)s` - Video ID
- `%(ext)s` - File extension
- `%(playlist_title)s` - Playlist name
- `%(playlist_index)s` - Position in playlist
