#!/usr/bin/env nu

# Show a summary of changed symbols between two jj revisions
def main [
    target: string = "@"       # Target revision (default: working copy)
    --from (-f): string = "@-" # Base revision to compare from
] {
    let base = $from

    # Get changed files
    let changed_files = (jj diff --from $base --to $target --summary
        | lines
        | where { |line| $line | str trim | is-not-empty }
        | parse "{status} {file}"
        | where { |row| 
            let ext = ($row.file | path parse | get extension | default "")
            $ext in ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp"]
        }
    )

    if ($changed_files | is-empty) {
        print "No code files changed"
        return
    }

    # Get the full diff
    let diff_output = (jj diff --from $base --to $target --git)

    # Symbol detection patterns
    let patterns = [
        '^\s*(export\s+)?(async\s+)?function\s+\w+'
        '^\s*(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\('
        '^\s*(export\s+)?class\s+\w+'
        '^\s*(export\s+)?interface\s+\w+'
        '^\s*(export\s+)?type\s+\w+\s*='
        '^\s*(export\s+)?enum\s+\w+'
        '^\s*(pub\s+)?(async\s+)?fn\s+\w+'
        '^\s*def\s+\w+'
        '^\s*class\s+\w+'
        '^\s*func\s+\w+'
    ]

    # Parse diff for symbol changes
    let symbols = ($diff_output
        | lines
        | where { |line|
            let starts_plus = ($line | str starts-with "+")
            let starts_minus = ($line | str starts-with "-")
            let is_header_plus = ($line | str starts-with "+++")
            let is_header_minus = ($line | str starts-with "---")
            ($starts_plus or $starts_minus) and (not $is_header_plus) and (not $is_header_minus)
        }
        | each { |line|
            let content = ($line | str substring 1..)
            let is_symbol = ($patterns | any { |p| $content =~ $p })
            if $is_symbol {
                let change_type = if ($line | str starts-with "+") { "added" } else { "removed" }
                let trimmed = ($content | str trim)
                
                # Extract symbol name
                let symbol = ($trimmed
                    | str replace -r '^\s*(export\s+)?(pub\s+)?(async\s+)?' ''
                    | str replace -r '^(function|class|interface|type|enum|fn|def|func|const|let)\s+' ''
                    | str replace -r '\s*[=({<:].*$' ''
                    | str replace -r '\s*extends.*$' ''
                    | str replace -r '\s*implements.*$' ''
                    | str trim
                )
                
                let def_preview = if (($trimmed | str length) > 80) {
                    ($trimmed | str substring 0..77) + "..."
                } else {
                    $trimmed
                }
                
                { change: $change_type, symbol: $symbol, definition: $def_preview }
            } else {
                null
            }
        }
        | compact
    )

    # Print summary
    print $"(ansi cyan)Changed files:(ansi reset)"
    $changed_files | each { |row|
        let status_icon = match $row.status {
            "M" => $"(ansi yellow)M(ansi reset)"
            "A" => $"(ansi green)A(ansi reset)"
            "D" => $"(ansi red)D(ansi reset)"
            _ => $row.status
        }
        print $"  ($status_icon) ($row.file)"
    }
    print ""

    if ($symbols | is-not-empty) {
        let added = ($symbols | where change == "added")
        let removed = ($symbols | where change == "removed")

        if ($added | is-not-empty) {
            print $"(ansi green)Added symbols:(ansi reset)"
            $added | each { |s|
                print $"  (ansi green)+(ansi reset) ($s.symbol)"
                print $"    (ansi dark_gray)($s.definition)(ansi reset)"
            }
            print ""
        }

        if ($removed | is-not-empty) {
            print $"(ansi red)Removed symbols:(ansi reset)"
            $removed | each { |s|
                print $"  (ansi red)-(ansi reset) ($s.symbol)"
                print $"    (ansi dark_gray)($s.definition)(ansi reset)"
            }
            print ""
        }

        # Summary stats
        print $"(ansi cyan)Summary:(ansi reset) ($added | length) added, ($removed | length) removed"
    } else {
        print $"(ansi dark_gray)No symbol-level changes detected(ansi reset)"
    }
}
