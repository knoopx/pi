---
name: jujutsu-auto-describe
description: Automatically generate and update descriptions for unpublished Jujutsu changes based on file modifications.
---

# Jujutsu Auto-Describe Skill

Automatically generate and update descriptions for unpublished Jujutsu changes based on file modifications.

## What This Skill Does

This skill analyzes unpublished (mutable) Jujutsu changes that lack proper descriptions or don't follow conventional commit format, examines their file modifications, and generates concise, meaningful descriptions following conventional commit standards.

**Key Actions:**

- Identifies jj changes without descriptions or with non-conventional descriptions
- Analyzes git diffs to understand what files were added, modified, or deleted
- Categorizes changes (feat, fix, chore, docs, etc.) based on file types and modifications
- Generates human-readable descriptions in conventional commit format
- Updates change descriptions using `jj describe`

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

To automatically describe all unpublished changes that need it:

1. Ensure you're in a jj repository
2. Run the agent with task: "Update descriptions for all unpublished jj changes"
3. The skill will:
   - Find all mutable changes (not pushed to remote)
   - Check if they have descriptions following conventional commit format
   - For changes without proper descriptions, analyze their diffs
   - Generate appropriate descriptions
   - Update the change descriptions
4. Immutable changes (already pushed or protected) will be skipped

### Advanced Usage

For specific changes or custom behavior:

- "Describe change abc123 with focus on feature additions"
- "Update descriptions for changes since yesterday"
- "Generate descriptions using conventional commit format"

## Implementation Steps

### 1. Identify Mutable Changes Needing Description Updates

Find all mutable (unpublished) changes that either:

- Have no description at all, or
- Have descriptions that don't follow conventional commit format (type(scope): description)

Query: `jj log -r 'all() & ~(remote_bookmarks() | remote_branches() | tags() | trunk())' --no-graph -T 'change_id ++ " " ++ description.first_line()'`

### 2. Analyze Each Change

For each identified change:

- Get the diff: `jj diff -r <change_id>`
- Parse the diff to identify:
  - Files added (+++ lines)
  - Files modified (both --- and +++ for same file)
  - Files deleted (--- lines without matching +++)

### 3. Generate Description

Based on the analysis:

- Determine change type: feat (new features), fix (bug fixes), chore (maintenance), docs (documentation), etc.
- Create a concise summary describing what was changed
- Format as conventional commit: `type(scope): description`

Examples:

- Added files → `feat(component): ✨ Add new component`
- Modified config files → `fix(config): 🐛 Update configuration`
- Documentation changes → `docs: 📝 Update readme`

### 4. Update Description

If the change is mutable, update its description:

```bash
jj describe <change_id> -m "Generated description"
```

Skip if:

- Change is empty (no diff)
- Change is already immutable
- Description is already conventional

## Change Analysis Patterns

### File Type Analysis

Analyze diff output to categorize changes by file types:

### File Type Analysis

Analyze diff output to categorize changes by file types:

- **Source Code (.ts, .js, .py, .rs, etc.)**:
  - Added: `feat(code): ✨ Add new feature/functionality`
  - Modified: `fix(code): 🐛 Update implementation` or `refactor(code): ♻️ Improve code structure`
  - Deleted: `chore(code): 🧹 Remove obsolete code`

- **Configuration (.json, .yaml, .toml, .config)**:
  - Changes: `fix(config): 🐛 Update configuration` or `feat(config): ✨ Add configuration option`

- **Documentation (.md, .txt, README)**:
  - Changes: `docs: 📝 Update documentation`

- **Assets (.png, .jpg, .svg, .css, .html)**:
  - Added: `feat(assets): ✨ Add new assets`
  - Modified: `fix(assets): 🐛 Update styling/assets`
  - Deleted: `chore(assets): 🧹 Remove unused assets`

### Conventional Commit Types

Map changes to standard types:

- **feat**: New features or functionality
- **fix**: Bug fixes
- **chore**: Maintenance, cleanup, no functional changes
- **docs**: Documentation updates
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code restructuring without functional changes
- **test**: Test additions/updates
- **perf**: Performance improvements
- **ci**: CI/CD changes
- **build**: Build system changes

## Example Descriptions

### Feature Addition

```
feat(auth): ✨ Add user authentication system

Added user authentication using JWT. This includes login, registration, and token verification endpoints.

- Implemented JWT-based authentication
- Added login and registration endpoints
- Added middleware for token verification

Fixes #123
```

### Bug Fix

```
fix(memory): 🐛 Resolve memory leak in data processing pipeline

Fixed memory leak in the data processing pipeline by properly closing database connections and adding timeout handling.

- Close database connections properly
- Add timeout handling for long-running queries
- Improve error handling in async operations

Closes #456
```

### Refactoring

```
refactor(components): ♻️ Improve architecture for testability

Refactored component architecture to improve testability by extracting business logic and adding dependency injection.

- Extract business logic into separate service classes
- Add dependency injection for easier mocking
- Improve separation of concerns
```

### Documentation

```
docs(api): 📝 Update API documentation

Updated API documentation to include missing parameter descriptions and fix examples in the usage guide.

- Add missing parameter descriptions
- Fix examples in usage guide
- Update changelog
```

### Maintenance

```
chore(deps): 🧹 Clean up unused dependencies

Removed unused npm packages and cleaned up import statements to reduce bundle size.

- Remove unused npm packages
- Update lockfile
- Clean up import statements
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

1. **Conventional Commits**: Always use conventional commit format: `type(scope):<icon> <short description>`
2. **Conciseness**: Keep short descriptions under 50 characters
3. **Include Long Descriptions**: Provide additional context and details after a blank line
4. **Clarity**: Use imperative mood ("Add feature" not "Added feature")
5. **Specificity**: Mention what changed, not just that it changed
6. **Consistency**: Follow project conventions for description format
7. **Completeness**: Include all significant modifications in the long description
8. **Context**: Reference related changes or issues when applicable
9. **Use Icons**: Include appropriate emoji icons for visual clarity

### Conventional Commit Types

Follow the comprehensive conventional commit types with icons:

- `feat`: ✨ New features
- `fix`: 🐛 Bug fixes
- `docs`: 📝 Documentation
- `style`: 💄 Code style changes (formatting, etc.)
- `refactor`: ♻️ Code restructuring
- `test`: ✅ Test additions
- `chore`: 🧹 Maintenance tasks
- `perf`: ⚡️ Performance improvements
- `ci`: 👷 CI/CD changes
- `build`: 🏗️ Build system changes
- `revert`: ⏪ Reverting changes
- `security`: 🔒 Security improvements
- `i18n`: 🌐 Internationalization changes
- `a11y`: ♿ Accessibility improvements
- `ux`: 🎨 User experience improvements
- `ui`: 🖌️ User interface changes
- `config`: 🔧 Configuration changes
- `deps`: 📦 Dependency updates
- `infra`: 🌐 Infrastructure changes
- `init`: 🎉 Initial commit
- `analytics`: 📈 Analytics changes
- `seo`: 🔍 SEO improvements
- `legal`: ⚖️ Legal changes
- `typo`: ✏️ Typo fixes
- `comment`: 💬 Comment changes
- `example`: 💡 Example changes
- `mock`: 🤖 Mock changes
- `hotfix`: 🚑 Hotfix changes
- `merge`: 🔀 Merge changes
- `cleanup`: 🧹 Cleanup changes
- `deprecate`: 🗑️ Deprecation changes
- `move`: 🚚 Move changes
- `rename`: ✏️ Rename changes
- `split`: ✂️ Split changes
- `combine`: 🧬 Combine changes
- `add`: ➕ Add changes
- `remove`: ➖ Remove changes
- `update`: ⬆️ Update changes
- `downgrade`: ⬇️ Downgrade changes
- `patch`: 🩹 Patch changes
- `optimize`: 🛠️ Optimize changes

## Configuration

### Exclusion Rules

Skip certain file types or patterns that should not be considered for description generation.

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

### Common Issues

- **No unpublished changes**: All changes are published or already have proper descriptions
- **Empty diff**: Skip changes with no file modifications
- **Immutable changes**: Skip changes that are already pushed or protected
- **Permission denied**: Check jj repository permissions
- **Invalid change ID**: Verify change exists before processing

### Recovery Strategies

- Backup current descriptions before updating
- Allow manual review of generated descriptions
- Provide option to skip problematic changes
- Use `jj describe <change_id> -m "new description"` to manually update
