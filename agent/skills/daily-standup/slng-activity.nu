#!/usr/bin/env nu

# Aggregate SLNG activity: Pi sessions and jj commits correlated by time
def main [
    --since: string = "yesterday"  # Date filter (e.g., "yesterday", "7 days ago", "2026-02-20")
    --format: string = "markdown"  # Output format: markdown or json
] {
    let slng_root = "/home/knoopx/Projects/slng"
    let sessions_root = $"($env.HOME)/.pi/agent/sessions"
    
    # Convert relative date to ISO format
    let since_date = if ($since =~ '^\d{4}-\d{2}-\d{2}$') {
        $since
    } else {
        let dt = match $since {
            "yesterday" => { (date now) - 1day }
            "today" => { date now }
            _ => {
                let parts = ($since | split words)
                let n = ($parts | first | into int)
                let unit = ($parts | get 1)
                match $unit {
                    "day" | "days" => { (date now) - ($n * 1day) }
                    "week" | "weeks" => { (date now) - ($n * 1wk) }
                    _ => { (date now) - 1day }
                }
            }
        }
        $dt | format date "%Y-%m-%d"
    }
    
    # Get jj commits from SLNG projects
    let projects = (ls $slng_root | where type == dir | get name)
    let commits = ($projects | each {|project|
        let project_name = ($project | path basename)
        cd $project
        
        let result = (do {
            jj log --no-graph --ignore-working-copy -r $"mine\(\) & immutable\(\) & committer_date\(after:\"($since_date)\"\)" -T 'change_id.short() ++ "\t" ++ author.timestamp().local().format("%Y-%m-%d %H:%M") ++ "\t" ++ description.first_line() ++ "\n"'
        } | complete)
        
        if $result.exit_code == 0 and ($result.stdout | str trim | is-not-empty) {
            $result.stdout 
            | lines 
            | where {|line| $line | str trim | is-not-empty }
            | each {|line|
                let parts = ($line | split column "\t" change_id timestamp description)
                {
                    type: "commit"
                    project: $project_name
                    timestamp: ($parts | get timestamp | first)
                    text: ($parts | get description | first | str trim)
                }
            }
        } else {
            []
        }
    } | flatten)
    
    # Get Pi session messages from SLNG projects
    let slng_dirs = (ls $sessions_root 
        | where type == dir 
        | where name =~ "slng" 
        | get name)
    
    let messages = ($slng_dirs | each {|dir|
        let encoded = ($dir | path basename)
        let project_name = ($encoded | str replace --regex '^--home-knoopx-Projects-slng-?' "" | str replace --regex '--$' "" | str replace --all "-" "/")
        # Use just first segment as project name for matching
        let project_short = ($project_name | split row "/" | first | default $project_name)
        
        let session_files = (ls $dir 
            | where name =~ '\.jsonl$'
            | where { ($in.name | path basename | str substring 0..10) >= $since_date }
            | get name)
        
        $session_files | each {|file|
            let parsed = (open $file | lines | each {|line| $line | from json })
            
            $parsed 
            | where {|m| $m.type? == "message" and $m.message?.role? == "user" }
            | each {|m|
                let text = ($m.message.content
                    | each {|c| $c.text? }
                    | compact
                    | first
                    | default ""
                    | lines
                    | first
                    | default ""
                    | str trim)
                let ts = ($m.timestamp? | default "" | str substring 0..16 | str replace "T" " ")
                if ($text | str length) > 0 {
                    {
                        type: "session"
                        project: $project_short
                        timestamp: $ts
                        text: $text
                    }
                }
            }
        }
    } | flatten | flatten | compact)
    
    # Merge and sort by timestamp
    let all_activity = ($commits | append $messages | sort-by timestamp --reverse)
    
    if ($all_activity | is-empty) {
        print $"No activity found since ($since)"
        return
    }
    
    match $format {
        "json" => {
            $all_activity | to json
        }
        _ => {
            print $"## SLNG Activity \(since ($since)\)\n"
            $all_activity | each {|item|
                let icon = if $item.type == "commit" { "📦" } else { "💬" }
                print $"- ($icon) **[($item.project)]** ($item.timestamp) ($item.text)"
            } | ignore
        }
    }
}
