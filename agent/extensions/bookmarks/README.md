# bookmarks

Firefox Places integration for bookmark/history lookup.

## What it actually does

- Reads `places.sqlite` from a fixed Firefox profile path:
  - `~/.mozilla/firefox/knoopx/places.sqlite`
- Copies the DB to a temp file before querying (avoids lock errors when Firefox is open).
- Uses fuzzy matching for query filtering.
- Renders results as terminal tables.

## Tools

### `firefox-bookmarks`

Search bookmark entries (title + URL).

Parameters:

- `query?: string`
- `limit?: number` (1-1000, default `50`)

### `firefox-history`

Search visited pages (title + URL + visit count).

Parameters:

- `query?: string`
- `limit?: number` (1-1000, default `50`)

## Output details

- Bookmark rows include: date added, title, URL.
- History rows include: visit count, last visit date, title, URL.
- Tool `details` includes `query` and `totalFound`.

## Caveats

- Profile path is currently hardcoded in `getFirefoxProfilePath()`.
- If the DB file does not exist, tools return an explicit error.
- Date formatting assumes Firefox microsecond timestamps.
