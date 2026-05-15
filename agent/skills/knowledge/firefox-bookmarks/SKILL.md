---
name: firefox-bookmarks
topic: Firefox Bookmarks
description: "Query Firefox bookmarks stored in places.sqlite via Nushell SQLite. Use when looking up bookmarked URLs, browsing Firefox bookmark history, or finding saved links."
token_cost: 100
keywords: ["firefox", "bookmark", "bookmarks", "saved", "link"]
requires_tools: [nu]
---

# Firefox Bookmarks

Search Firefox bookmarks stored in `places.sqlite` using Nushell's built-in SQLite support.

## Searching Bookmarks

Use the provided script for consistent results:

```nu
# Search by keywords (matches titles and URLs, case-insensitive)
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu "scraping crawling"

# Single term — defaults to 50 results, most recent first
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu "typescript"

# Pagination and custom limit
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu --page 2 --limit 10 "docker"

# Override profile (default resolves from $env.USER)
^~/.pi/agent/skills/firefox-bookmarks/scripts/search-bookmarks.nu --profile ks7i6rp1.default "docker"
```

Results are deduplicated by URL and exclude `javascript:` URLs. Use `--page N` for subsequent pages and `--limit N` (max 50) to adjust page size.

## Ad-Hoc Query

For one-off queries not covered by the script:

```nu
open ~/.mozilla/firefox/knoopx/places.sqlite | query db "SELECT b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 LIMIT 20"
```

Bookmarks are in `moz_bookmarks` joined to `moz_places` via `b.fk = p.id`. Filter with `b.type = 1` for actual bookmarks (not folders or separators).

## Constraints

- Firefox must not be running when querying — SQLite locks the database
- If Firefox is open, copy first: `cp places.sqlite /tmp/places.sqlite`, then query the copy
