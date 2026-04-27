#!/usr/bin/env nu

# Search Firefox bookmarks by keyword.
# Usage: search-bookmarks.nu "term1 term2" [--profile name] [--page N] [--limit N]

def main [
    terms: string           # Space-separated search terms
    --profile: string       # Profile name (default: $env.USER)
    --page: int = 1         # Page number (1-indexed)
    --limit: int = 50       # Max results per page (max 50)
] {
    let profile = ($profile | default $env.USER)
    let db_path = $"($env.HOME)/.mozilla/firefox/($profile)/places.sqlite"

    if not ($db_path | path exists) {
        print $"Error: Database not found at ($db_path)"
        exit 1
    }

    if $limit > 50 {
        print "Error: --limit cannot exceed 50"
        exit 1
    }

    if $page < 1 {
        print "Error: --page must be >= 1"
        exit 1
    }

    let offset = (($page - 1) * $limit)

    let words = ($terms | split row " ")
    let like_clauses = (
        $words | each { |t| ["LOWER(b.title) LIKE '%" $t "%' OR LOWER(p.url) LIKE '%" $t "%'"] | str join }
        | str join " OR "
    )

    let sql = $"SELECT DISTINCT b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 AND ($like_clauses) ORDER BY b.lastModified DESC LIMIT ($limit) OFFSET ($offset)"

    let results = (
        open $db_path | query db $sql
        | where url !~ "javascript:"
        | uniq -i
    )

    if ($results | is-empty) {
        print "No bookmarks found."
        exit 0
    }

    let total_on_page = ($results | length)
    let header = "--- Page " + ($page | into string) + " / " + ($total_on_page | into string) + " results ---"
    print $header

    $results | each { |r|
        let domain = ($r.url | parse --regex "https?://(?P<host>[^/]+).*" | get host.0 | default $r.url)
        print $"* ($r.title) [($r.url)]"
        print $"  ($domain)"
    } | ignore
}
