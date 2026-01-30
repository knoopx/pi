# GitHub CLI Reference

Detailed information about gh commands and options.

## Repository Management

### Viewing Repositories

```bash
# View current repository
gh repo view

# View specific repository
gh repo view owner/repo

# View with web preview
gh repo view --web

# View with JSON output
gh repo view --json name,owner,url

# View with jq filtering
gh repo view --json name,owner --jq '.name'
```

### Cloning and Forking

```bash
# Clone repository
gh repo clone owner/repo

# Clone to specific directory
gh repo clone owner/repo my-project

# Fork current repository
gh repo fork

# Fork to specific user/org
gh repo fork --clone --org target-org

# Sync fork with upstream
gh repo sync
```

### Creating and Listing

```bash
# Create new repository
gh repo create name

# Create private repository
gh repo create name --private

# Create with description
gh repo create name --description "My awesome repo"

# List your repositories
gh repo list

# List user's repositories
gh repo list username

# List organizations
gh repo list org-name
```

## Issues

### Listing Issues

```bash
# List open issues
gh issue list

# List all issues
gh issue list --state all

# List closed issues
gh issue list --state closed

# List issues assigned to you
gh issue list --assignee @me

# List issues by author
gh issue list --author @me

# List issues by label
gh issue list --label bug

# List issues by milestone
gh issue list --milestone "1.0"

# Limit results
gh issue list --limit 10

# Output as JSON
gh issue list --json number,title,state
```

### Viewing Issues

```bash
# View specific issue
gh issue view 123

# View with comments
gh issue view 123 --comments

# View with web preview
gh issue view 123 --web

# View with JSON output
gh issue view 123 --json title,body,state
```

### Creating Issues

```bash
# Interactive create
gh issue create

# With title and body
gh issue create --title "Bug" --body "Description"

# With labels
gh issue create --title "Bug" --label bug,high-priority

# With milestone
gh issue create --title "Feature" --milestone "1.0"

# Assign to user
gh issue create --title "Task" --assignee @me

# With project board
gh issue create --project "Project Board"

# Template
gh issue create --template bug-template.md
```

### Editing Issues

```bash
# Edit issue
gh issue edit 123

# Add label
gh issue edit 123 --add-label bug

# Remove label
gh issue edit 123 --remove-label bug

# Set milestone
gh issue edit 123 --set-milestone "1.0"

# Assign/unassign
gh issue edit 123 --assignee @me
gh issue edit 123 --remove-assignee @me

# Close/reopen
gh issue edit 123 --close
gh issue edit 123 --reopen
```

### Comments

```bash
# Comment on issue
gh issue comment 123 --body "Here's a comment"

# Edit comment
gh issue comment 123 --edit 456 --body "Updated comment"

# Delete comment
gh issue comment 123 --delete 456

# List comments
gh issue view 123 --comments --json comments
```

### Other Issue Operations

```bash
# Close issue
gh issue close 123

# Reopen issue
gh issue reopen 123

# List timeline
gh issue view 123 --timeline
```

## Pull Requests

### Listing Pull Requests

```bash
# List open PRs
gh pr list

# List all PRs
gh pr list --state all

# List merged PRs
gh pr list --state merged

# List PRs by author
gh pr list --author @me

# List PRs by reviewer
gh pr list --reviewer @me

# List PRs by label
gh pr list --label bug

# List PRs by milestone
gh pr list --milestone "1.0"

# Limit results
gh pr list --limit 10

# Output as JSON
gh pr list --json number,title,author,state
```

### Viewing Pull Requests

```bash
# View specific PR
gh pr view 123

# View with web preview
gh pr view 123 --web

# View with JSON output
gh pr view 123 --json title,body,state,reviewRequests

# View with comments
gh pr view 123 --comments

# View PR checks
gh pr checks 123

# View PR diff
gh pr diff 123

# View PR files
gh pr view 123 --files
```

### Creating Pull Requests

```bash
# Interactive create
gh pr create

# Auto-fill from commits
gh pr create --fill

# With title and body
gh pr create --title "feat: add feature" --body "Description"

# Target specific branch
gh pr create --base main

# Draft PR
gh pr create --draft

# With labels
gh pr create --label bug,high-priority

# With milestone
gh pr create --milestone "1.0"

# Assign to reviewer
gh pr create --reviewer @me

# With project board
gh pr create --project "Project Board"

# Template
gh pr create --template pr-template.md
```

### Reviewing Pull Requests

```bash
# Approve PR
gh pr review 123 --approve

# Request changes
gh pr review 123 --request-changes --body "Please fix X"

# Add comment
gh pr review 123 --comment --body "Looks good"

# Comment on specific review
gh pr review 123 --comment --review-id 456 --body "Comment"

# Dismiss review
gh pr review 123 --dismiss --body "Reason"
```

### Merging Pull Requests

```bash
# Merge PR
gh pr merge 123

# Squash merge
gh pr merge 123 --squash

# Rebase merge
gh pr merge 123 --rebase

# Create merge commit
gh pr merge 123 --commit

# Delete branch after merge
gh pr merge 123 --delete-branch

# Merge with message
gh pr merge 123 --message "Merge message"
```

### Other PR Operations

```bash
# Checkout PR locally
gh pr checkout 123

# Mark PR as ready
gh pr ready 123

# Mark PR as draft
gh pr ready 123 --draft

# Request review
gh pr review 123 --request-changes

# List review requests
gh pr view 123 --json reviewRequests

# List reviewers
gh pr view 123 --json reviewers

# List CI checks
gh pr checks 123
```

## Search

### Searching Repositories

```bash
# Search repositories
gh search repos "react language:typescript stars:>1000"

# Search by owner
gh search repos "owner:facebook"

# Search by language
gh search repos "language:python"

# Search by topics
gh search repos "topic:frontend"

# Search by stars
gh search repos "stars:>1000"

# Limit results
gh search repos "react" --limit 20

# Output as JSON
gh search repos "react" --json name,url,stargazerCount
```

### Searching Issues

```bash
# Search issues
gh search issues "repo:owner/repo is:open label:bug"

# Search by author
gh search issues "author:@me is:open"

# Search by label
gh search issues "label:bug"

# Search by state
gh search issues "is:open is:issue"

# Search by milestone
gh search issues "milestone:1.0"

# Search by assignee
gh search issues "assignee:@me"

# Search by repository
gh search issues "repo:owner/repo"

# Limit results
gh search issues "bug" --limit 10

# Output as JSON
gh search issues "bug" --json number,title,state
```

### Searching PRs

```bash
# Search PRs
gh search prs "repo:owner/repo is:open review:required"

# Search by author
gh search prs "author:@me"

# Search by reviewer
gh search prs "reviewer:@me"

# Search by label
gh search prs "label:bug"

# Search by state
gh search prs "is:open is:pr"

# Limit results
gh search prs "review:required" --limit 10

# Output as JSON
gh search prs "review:required" --json number,title,state
```

### Searching Code

```bash
# Search code
gh search code "function main repo:owner/repo"

# Search by filename
gh search code "filename:config.json owner:org"

# Search by language
gh search code "language:typescript"

# Search by extension
gh search code "extension:ts"

# Limit results
gh search code "main" --limit 20

# Output as JSON
gh search code "main" --json name,path
```

### Searching Commits

```bash
# Search commits
gh search commits "fix bug repo:owner/repo"

# Search by author
gh search commits "author:@me"

# Search by message
gh search commits "message:fix"

# Search by branch
gh search commits "branch:main"

# Limit results
gh search commits "bug" --limit 10

# Output as JSON
gh search commits "bug" --json oid,author,committedDate
```

## Releases

### Listing Releases

```bash
# List releases
gh release list

# List releases with JSON
gh release list --json tagName,name,publishedAt

# Limit results
gh release list --limit 10
```

### Viewing Releases

```bash
# View specific release
gh release view v1.0.0

# View with web preview
gh release view v1.0.0 --web

# View with JSON
gh release view v1.0.0 --json tagName,body,publishedAt
```

### Creating Releases

```bash
# Create release
gh release create v1.0.0

# Create draft release
gh release create v1.0.0 --draft

# With title and body
gh release create v1.0.0 --title "Release 1.0.0" --body "Changes"

# With assets
gh release create v1.0.0 ./dist/* --clobber

# With notes from file
gh release create v1.0.0 --notes-file RELEASE_NOTes.md

# Tag from commit
gh release create v1.0.0 --target <commit-sha>
```

### Downloading Releases

```bash
# Download all assets
gh release download v1.0.0

# Download specific asset
gh release download v1.0.0 --dir ./downloads

# Download with pattern
gh release download v1.0.0 --pattern "*.tar.gz"
```

### Other Release Operations

```bash
# Delete release
gh release delete v1.0.0

# Edit release
gh release edit v1.0.0

# List release assets
gh release view v1.0.0 --json assets

# Get release URL
gh release view v1.0.0 --json url
```

## Gists

### Listing Gists

```bash
# List your gists
gh gist list

# List all gists
gh gist list --all

# List with JSON
gh gist list --json id,name,public
```

### Creating Gists

```bash
# Create from file
gh gist create file.txt

# Create as public
gh gist create file.txt -p

# With title
gh gist create file.txt --title "My Gist"

# With description
gh gist create file.txt --description "A gist for..."

# Multiple files
gh gist create file1.txt file2.txt
```

### Viewing Gists

```bash
# View gist
gh gist view <id>

# View with web preview
gh gist view <id> --web

# View with JSON
gh gist view <id> --json files,repository
```

### Editing and Deleting

```bash
# Edit gist
gh gist edit <id>

# Delete gist
gh gist delete <id>

# Clone gist
gh gist clone <id>

# View gist files
gh gist view <id> --files
```

## API Requests

### REST API

```bash
# Get repository info
gh api repos/{owner}/{repo}

# Get issues
gh api repos/{owner}/{repo}/issues

# Get PRs
gh api repos/{owner}/{repo}/pulls

# Get commits
gh api repos/{owner}/{repo}/commits

# Get commits with pagination
gh api repos/{owner}/{repo}/commits --paginate

# Get commit
gh api repos/{owner}/{repo}/commits/{commit-sha}
```

### POST Requests

```bash
# Create issue
gh api -X POST repos/{owner}/{repo}/issues \
  -f title="Bug" -f body="Description"

# Create PR
gh api -X POST repos/{owner}/{repo}/pulls \
  -f title="Feature" -f head="feature-branch" -f base="main"

# Add comment to issue
gh api -X POST repos/{owner}/{repo}/issues/{issue-number}/comments \
  -f body="Comment"
```

### Query Parameters

```bash
# With query parameters
gh api -X GET search/issues -f q='repo:cli/cli is:open'

# With specific format
gh api repos/{owner}/{repo}/issues \
  -f label="bug" \
  -f state="open" \
  -f per_page=10

# With sorting
gh api repos/{owner}/{repo}/issues \
  -f sort=created \
  -f direction=asc
```

### GraphQL

```bash
# Simple query
gh api graphql -f query='{ viewer { login } }'

# Query with variables
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($name: String!, $owner: String!) {
    repository(owner: $owner, name: $name) {
      stargazerCount
    }
  }
'

# Query with JSON output
gh api graphql -f query='...' --json stargazerCount
```

### jq Filtering

```bash
# Filter JSON output
gh issue list --json title --jq '.[].title'

# Format output
gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'

# Group by property
gh issue list --json number,title,state --jq '.[] | select(.state == "open")'

# Extract specific fields
gh repo view --json name,owner --jq '{name: .name, owner: .owner.login}'
```

## Status & Notifications

### GitHub Status

```bash
# Get your GitHub status
gh status

# Status for organization
gh status -o org-name

# Exclude repository
gh status -e owner/repo
```

## Workflows

### Listing Workflows

```bash
# List workflows
gh workflow list

# List workflows with JSON
gh workflow list --json name,createdAt,state
```

### Viewing Workflows

```bash
# View workflow
gh workflow view <workflow>

# View with JSON
gh workflow view <workflow> --json name,createdAt,state
```

### Running Workflows

```bash
# Trigger workflow
gh workflow run <workflow>

# Trigger with inputs
gh workflow run <workflow> --field name=value

# Run with JSON input
gh workflow run <workflow> -f '{"key":"value"}'
```

### Workflow Runs

```bash
# List workflow runs
gh run list

# View run details
gh run view <run-id>

# View with JSON
gh run view <run-id> --json conclusion,headBranch

# Download artifacts
gh run download <run-id>

# Watch run progress
gh run watch <run-id>

# List workflow run jobs
gh run view <run-id> --json jobs
```

## Common Flags

| Flag                      | Description                |
| ------------------------- | -------------------------- |
| `-R owner/repo`           | Target specific repository |
| `--web`                   | Open in browser            |
| `--json fields`           | Output as JSON             |
| `--jq query`              | Filter JSON output         |
| `--limit N`               | Limit results              |
| `--state open/closed/all` | Filter by state            |
| `--author @user`          | Filter by author           |
| `--reviewer @user`        | Filter by reviewer         |
| `--label label-name`      | Filter by label            |
| `--milestone name`        | Filter by milestone        |
| `--assignee @user`        | Filter by assignee         |

## JSON Output

### Getting JSON Output

```bash
# Get JSON output for all commands
gh issue list --json number,title,state
gh pr list --json number,title,author

# Get JSON with multiple fields
gh repo view --json name,owner,url,createdAt,updatedAt

# Filter with jq
gh issue list --json title --jq '.[].title'
gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'
```

### jq Examples

```bash
# Extract and format
gh issue list --json title --jq '.[] | "- " + .title'

# Filter by state
gh issue list --json number,title,state --jq '.[] | select(.state == "open")'

# Count results
gh issue list --json number --jq '. | length'

# Group by state
gh issue list --json title,state --jq 'group_by(.state) | map({state: .[0].state, count: length})'

# Extract specific fields
gh repo view --json name,owner --jq '{name: .name, owner: .owner.login}'

# Sort by date
gh issue list --json number,publishedAt --jq 'sort_by(.publishedAt) | reverse'
```

## Tips

- Use `{owner}` and `{repo}` placeholders in API calls (auto-filled from current dir)
- Use `--web` to open any resource in browser
- Use `--json` with `--jq` for scriptable output
- Use `-R owner/repo` to target different repositories
- `gh auth status` to check authentication
- `gh config set editor vim` to set default editor
- Use `gh alias set` to create command shortcuts
- Use `--cache` for faster repeated queries
- Use `--paginate` for large result sets
