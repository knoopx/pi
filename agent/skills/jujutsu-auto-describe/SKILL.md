---
name: jujutsu-auto-describe
description: Automatically generate and update descriptions for unpublished Jujutsu changes based on file modifications.
---

# Jujutsu Auto-Describe Skill

Automatically generate and update descriptions for unpublished Jujutsu changes based on file modifications.

Use this to:
- Generate meaningful descriptions for draft changes in Jujutsu repositories
- Analyze file modifications to create appropriate commit messages
- Update existing descriptions with improved summaries
- Maintain descriptive change history in jj-managed projects

Jujutsu (jj) is a Git-compatible version control system that uses changes instead of commits. This skill helps maintain good descriptions for unpublished changes by analyzing the modifications and generating concise, informative descriptions.

## Prerequisites

- Jujutsu (jj) must be installed and available in PATH
- Repository must be a valid jj repository
- Changes should be unpublished (not pushed to remote)

## Core Concepts

- **Changes**: jj's equivalent of commits, representing units of work
- **Working Copy**: Current state of files being modified
- **Unpublished Changes**: Changes that exist locally but haven't been pushed
- **Descriptions**: Human-readable summaries of what the change accomplishes

## Usage

### Basic Usage

To automatically describe all unpublished changes:

1. Ensure you're in a jj repository
2. Run the agent with task: "Update descriptions for all unpublished jj changes"
3. The skill will analyze each change and generate/update its description
4. Immutable changes (already pushed or protected) will be skipped

### Advanced Usage

For specific changes or custom behavior:

- "Describe change abc123 with focus on feature additions"
- "Update descriptions for changes since yesterday"
- "Generate descriptions using conventional commit format"

## Implementation Steps

### 1. Identify Unpublished Changes

```bash
# Get list of unpublished changes
jj log --no-graph -r '::@ & ~remote_branches()' -T 'change_id ++ " " ++ description'
```

This finds all changes reachable from the current working copy but not in any remote branch.

### 2. Analyze Each Change

For each change ID:

```bash
# Get detailed change info
jj show <change_id> --summary

# Get the diff
jj diff -r <change_id> --git
```

### 3. Generate Description

Based on the diff and summary:

- Identify modified files and types of changes
- Categorize changes (feature, bugfix, refactor, etc.)
- Create concise but descriptive summary
- Use conventional commit format if applicable

### 4. Check Mutability

Before updating the description, verify the change is mutable:

```bash
# Check if change is immutable
jj log --no-graph -r '<change_id> & (remote_bookmarks() | remote_branches() | tags() | trunk())' -T 'change_id'
```

If the command returns the change ID, the change is immutable and cannot be modified. Skip to the next change.

### 5. Update Description

If the change is mutable, update its description:

```bash
# Update the change description
jj describe <change_id> -m "New description here"
```

## Change Analysis Patterns

### File Type Analysis

- **Source Code (.ts, .js, .py, etc.)**: Focus on functionality changes
- **Configuration (.json, .yaml, .toml)**: Note setting modifications
- **Documentation (.md, .txt)**: Highlight content updates
- **Assets (.png, .jpg, .svg)**: Mention additions/removals

### Change Type Detection

- **Added files**: "Add [feature/component]"
- **Modified files**: "Update [component] to [change]"
- **Deleted files**: "Remove [obsolete feature]"
- **Renamed files**: "Rename [old] to [new]"
- **Refactored code**: "Refactor [component] for [improvement]"

## Example Descriptions

### Feature Addition
```
Add user authentication system with JWT tokens
- Implement login/logout endpoints
- Add password hashing and validation
- Create user session management
```

### Bug Fix
```
Fix memory leak in data processing pipeline
- Close database connections properly
- Add timeout handling for long-running queries
- Improve error handling in async operations
```

### Refactoring
```
Refactor component architecture for better testability
- Extract business logic into separate service classes
- Add dependency injection for easier mocking
- Improve separation of concerns
```

## Error Handling

### Common Issues

- **No unpublished changes**: Inform user that all changes are published
- **Empty diff**: Skip changes with no modifications
- **Immutable changes**: Skip changes that are already pushed or protected
- **Permission denied**: Check jj repository permissions
- **Invalid change ID**: Verify change exists before processing

### Recovery Strategies

- Backup current descriptions before updating
- Allow manual review of generated descriptions
- Provide option to skip problematic changes

## Integration with Other Tools

### Code Analysis
- Use `code-stats` to understand project structure
- Use `code-inspect` to analyze modified files
- Use `lsp-diagnostics` to check for introduced issues

### Content Generation
- Use `search-code` to find similar change patterns
- Use `search-web` for conventional commit standards
- Use AI assistance for complex description generation

## Best Practices

1. **Conciseness**: Keep descriptions under 50 characters for summary line
2. **Clarity**: Use imperative mood ("Add feature" not "Added feature")
3. **Specificity**: Mention what changed, not just that it changed
4. **Consistency**: Follow project conventions for description format
5. **Completeness**: Include all significant modifications
6. **Context**: Reference related changes or issues when applicable

## Configuration

### Custom Templates

Create description templates for common change types:

```typescript
const templates = {
  feature: "feat: add {component} {functionality}",
  bugfix: "fix: resolve {issue} in {component}",
  refactor: "refactor: improve {component} {aspect}",
  docs: "docs: update {section} documentation"
};
```

### Exclusion Rules

Skip certain file types or patterns:

```typescript
const excludePatterns = [
  /\.lock$/,
  /node_modules\//,
  /\.git\//
];
```

## Troubleshooting

### jj Command Issues

- Ensure jj is installed: `jj --version`
- Check repository status: `jj status`
- Verify remote configuration: `jj git remote list`

### Description Generation Issues

- Review diff manually: `jj diff -r <change_id>`
- Check file modification times: `jj show <change_id> --summary`
- Validate generated descriptions before applying
- Check if change is immutable: `jj log -r '<change_id> & (remote_bookmarks() | remote_branches() | tags() | trunk())' -T 'change_id'`

## Related Skills

- **jujutsu**: Core jj commands for repository management and change operations
- **typescript**: TypeScript analysis for code modification understanding

## Related Tools

- **code-stats**: Analyze codebase structure for better descriptions
- **code-inspect**: Examine modified files for detailed change analysis
- **code-callers**: Understand function relationships in changes
- **search-code**: Find examples of good commit message patterns
- **git**: Similar functionality for traditional Git repositories
- **bash**: Execute jj commands and shell operations
- **lsp-diagnostics**: Ensure changes don't introduce new issues