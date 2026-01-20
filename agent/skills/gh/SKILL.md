---
name: gh
description: Interact with GitHub repositories, issues, pull requests, releases, gists, and more using the gh CLI. Use when managing GitHub resources, searching code/repos, creating PRs/issues, or making API requests.
---

# GitHub CLI (gh) Cheatsheet

The GitHub CLI brings GitHub functionality to your terminal.

## Key Commands

| Command | Description |
|---------|-------------|
| `gh repo view` | View repository details |
| `gh repo clone owner/repo` | Clone a repository |
| `gh issue list` | List issues |
| `gh issue create` | Create a new issue |
| `gh pr list` | List pull requests |
| `gh pr create` | Create a pull request |
| `gh pr checkout 123` | Checkout a PR locally |
| `gh search repos "query"` | Search repositories |
| `gh api <endpoint>` | Make API requests |
| `gh status` | Show your GitHub status |

## Repository Management

```bash
gh repo view                      # View current repo
gh repo view owner/repo           # View specific repo
gh repo view --web                # Open in browser
gh repo clone owner/repo          # Clone repository
gh repo fork                      # Fork current repo
gh repo create name               # Create new repo
gh repo list                      # List your repos
gh repo list owner                # List user/org repos
gh repo sync                      # Sync fork with upstream
```

## Issues

```bash
gh issue list                     # List open issues
gh issue list --state all         # All issues
gh issue list --assignee @me      # Assigned to you
gh issue list --label bug         # Filter by label
gh issue view 123                 # View issue
gh issue view 123 --comments      # With comments
gh issue create                   # Interactive create
gh issue create --title "T" --body "B"
gh issue close 123                # Close issue
gh issue reopen 123               # Reopen issue
gh issue comment 123 --body "msg" # Add comment
gh issue edit 123 --add-label bug # Edit issue
```

## Pull Requests

```bash
gh pr list                        # List open PRs
gh pr list --state merged         # Merged PRs
gh pr list --author @me           # Your PRs
gh pr view 123                    # View PR
gh pr view 123 --web              # Open in browser
gh pr checkout 123                # Checkout PR locally
gh pr create                      # Interactive create
gh pr create --fill               # Auto-fill from commits
gh pr create --draft              # Create as draft
gh pr merge 123                   # Merge PR
gh pr merge 123 --squash          # Squash merge
gh pr merge 123 --rebase          # Rebase merge
gh pr review 123 --approve        # Approve PR
gh pr review 123 --comment -b "m" # Comment on PR
gh pr diff 123                    # View PR diff
gh pr checks 123                  # View CI status
gh pr ready 123                   # Mark as ready
```

## Search

```bash
# Search repositories
gh search repos "react language:typescript stars:>1000"
gh search repos "owner:facebook" --limit 20

# Search issues
gh search issues "repo:owner/repo is:open label:bug"
gh search issues "author:@me is:open"

# Search PRs
gh search prs "repo:owner/repo is:open review:required"

# Search code
gh search code "function main repo:owner/repo"
gh search code "filename:config.json owner:org"

# Search commits
gh search commits "fix bug repo:owner/repo"
```

## Releases

```bash
gh release list                   # List releases
gh release view v1.0.0            # View release
gh release create v1.0.0          # Create release
gh release create v1.0.0 --draft  # Draft release
gh release create v1.0.0 ./dist/* # With assets
gh release download v1.0.0        # Download assets
gh release delete v1.0.0          # Delete release
```

## Gists

```bash
gh gist list                      # List your gists
gh gist create file.txt           # Create from file
gh gist create -p file.txt        # Public gist
gh gist view <id>                 # View gist
gh gist edit <id>                 # Edit gist
gh gist clone <id>                # Clone gist
gh gist delete <id>               # Delete gist
```

## API Requests

```bash
# REST API
gh api repos/{owner}/{repo}       # Get repo info
gh api repos/{owner}/{repo}/issues
gh api /user                      # Current user
gh api -X POST repos/{owner}/{repo}/issues \
  -f title="Bug" -f body="Description"

# With query parameters
gh api -X GET search/issues -f q='repo:cli/cli is:open'

# With pagination
gh api repos/{owner}/{repo}/issues --paginate

# Format output with jq
gh api repos/{owner}/{repo}/issues --jq '.[].title'

# GraphQL
gh api graphql -f query='{ viewer { login } }'
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($name: String!, $owner: String!) {
    repository(owner: $owner, name: $name) {
      stargazerCount
    }
  }
'
```

## Status & Notifications

```bash
gh status                         # Your GitHub status
gh status -o org-name             # Status for org
gh status -e owner/repo           # Exclude repo
```

## Workflows (GitHub Actions)

```bash
gh run list                       # List workflow runs
gh run view <run-id>              # View run details
gh run download <run-id>          # Download artifacts

# Watch run progress (use tmux for background)
tmux new -d -s gh-watch 'gh run watch <run-id>'
gh workflow list                  # List workflows
gh workflow run <workflow>        # Trigger workflow
gh workflow view <workflow>       # View workflow
```

## Common Flags

| Flag | Description |
|------|-------------|
| `-R owner/repo` | Target specific repository |
| `--web` | Open in browser |
| `--json fields` | Output as JSON |
| `--jq query` | Filter JSON output |
| `--limit N` | Limit results |
| `--state open/closed/all` | Filter by state |

## JSON Output

```bash
# Get JSON output
gh issue list --json number,title,state
gh pr list --json number,title,author

# Filter with jq
gh issue list --json title --jq '.[].title'
gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## Tips

- Use `{owner}` and `{repo}` placeholders in API calls (auto-filled from current dir)
- Use `--web` to open any resource in browser
- Use `--json` with `--jq` for scriptable output
- Use `-R owner/repo` to target different repositories
- `gh auth status` to check authentication
- `gh config set editor vim` to set default editor
- Use `gh alias set` to create command shortcuts
