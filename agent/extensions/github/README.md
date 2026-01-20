# GitHub Extension

Tools for interacting with GitHub repositories and users.

## Installation

No additional installation required. This extension uses the public GitHub API.

## Tools

### github-repository-info

**Label:** GitHub Repository Info

**Description:** Retrieve detailed information about a GitHub repository.

Use this to:
- Check repository statistics and metadata
- Get information about stars, forks, and contributors
- View repository description and topics
- Access repository URLs and clone information

Returns comprehensive repository details from the GitHub API.

**Parameters:**
- `owner` (string): Repository owner (username or organization)
- `repo` (string): Repository name

### github-user-info

**Label:** GitHub User Info

**Description:** Get profile information about a GitHub user.

Use this to:
- View user bio and location
- Check follower/following counts
- See public repository statistics
- Access user profile URLs

Returns detailed user profile data from GitHub.

**Parameters:**
- `username` (string): GitHub username

### github-repository-issues

**Label:** GitHub Repository Issues

**Description:** Fetch issues from a GitHub repository.

Use this to:
- Monitor project issues and bug reports
- Track development progress
- Find feature requests and discussions
- Analyze repository activity

Supports filtering by state (open/closed/all). Limited to 10 issues by default.

**Parameters:**
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `state` (enum, optional): Issue state (open/closed/all) (default: open)
- `per_page` (number, optional): Number of issues to return (1-20) (default: 10)

### github-raw-file

**Label:** GitHub Raw File

**Description:** Download the raw content of a file from GitHub.

Use this to:
- Access source code files directly
- Download configuration files
- Retrieve documentation or README files
- Get files from specific branches or commits

Returns the file content as plain text. Limited to 100KB files.

**Parameters:**
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `path` (string): Path to the file in the repository
- `ref` (string, optional): Branch, tag, or commit SHA (defaults to default branch)

### search-github-repositories

**Label:** Search GitHub Repositories

**Description:** Search for repositories on GitHub using advanced queries.

Use this to:
- Find projects by language or topic
- Discover popular or trending repositories
- Locate libraries and frameworks
- Research similar projects

Supports sorting by stars, forks, or update date. Limited to 10 results by default.

**Parameters:**
- `query` (string): Search query (e.g., 'language:javascript stars:>1000')
- `sort` (enum, optional): Sort field (stars/forks/updated) (default: stars)
- `order` (enum, optional): Sort order (asc/desc) (default: desc)
- `per_page` (number, optional): Number of results (1-20) (default: 10)