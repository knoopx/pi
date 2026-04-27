---
name: firefox-bookmarks
description: "Searches Firefox bookmarks using Nushell's native SQLite query. Use when searching saved bookmarks, finding bookmarked tools/libraries, or browsing Firefox bookmark history."
---

# Firefox Bookmarks

Search Firefox bookmarks stored in `places.sqlite` using Nushell's built-in SQLite support.

## Workflow

### Search by Keywords

```nu
# Run the reusable script with space-separated search terms
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu "scraping crawling"

# Single term (default: 50 results, most recent first)
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu "typescript"

# Pagination and custom limit
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu --page 2 --limit 10 "docker"

# Override profile (default is $env.USER)
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu --profile ks7i6rp1.default "docker"
```

The script matches against both bookmark titles and URLs (case-insensitive). Results are ordered by most recently modified first, deduplicated by URL, and filtered to exclude `javascript:` URLs. Defaults to 50 results per page; use `--page N` for subsequent pages and `--limit N` (max 50) to adjust page size.

### Direct Query (Ad-Hoc)

For one-off queries not covered by the script:

```nu
open ~/.mozilla/firefox/knoopx/places.sqlite | query db "SELECT b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 LIMIT 20"
```

## Details

- Bookmarks live in `places.sqlite` under `~/.mozilla/firefox/<profile>/`
- Entries are in `moz_bookmarks` joined to `moz_places` via `b.fk = p.id`
- `b.type = 1` filters for actual bookmarks (not folders or separators)
- Default profile is resolved from `$env.USER`; override with `--profile`
- Duplicate rows occur when a URL is bookmarked in multiple folders — the script deduplicates by URL

## Constraints

- Firefox must not be running when querying (SQLite locks the database)
- If Firefox is open, copy `places.sqlite` to a temp path first: `cp places.sqlite /tmp/places.sqlite`
