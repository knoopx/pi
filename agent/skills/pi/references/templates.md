# Prompt Templates Reference

Prompt templates are Markdown snippets that expand into full prompts. Type `/name` in the editor to invoke a template, where `name` is the filename without `.md`.

## Locations

Pi loads prompt templates from:

- Global: `~/.pi/agent/prompts/*.md`
- Project: `.pi/prompts/*.md`
- Packages: `prompts/` directories or `pi.prompts` entries in `package.json`
- Settings: `prompts` array with files or directories
- CLI: `--prompt-template <path>` (repeatable)

Disable discovery with `--no-prompt-templates`.

## Format

```markdown
---
description: Review staged git changes
---

Review the staged changes (`git diff --cached`). Focus on:

- Bugs and logic errors
- Security issues
- Error handling gaps
```

- The filename becomes the command name. `review.md` becomes `/review`.
- `description` is optional. If missing, the first non-empty line is used.

## Usage

Type `/` followed by the template name in the editor. Autocomplete shows available templates with descriptions.

```
/review                           # Expands review.md
/component Button                 # Expands with argument
/component Button "click handler" # Multiple arguments
```

## Arguments

Templates support positional arguments and simple slicing:

- `$1`, `$2`, ... positional args
- `$@` or `$ARGUMENTS` for all args joined
- `${@:N}` for args from the Nth position (1-indexed)
- `${@:N:L}` for `L` args starting at N

Example:

```markdown
---
description: Create a component
---

Create a React component named $1 with features: $@
```

Usage: `/component Button "onClick handler" "disabled support"`

## Loading Rules

- Template discovery in `prompts/` is non-recursive.
- If you want templates in subdirectories, add them explicitly via `prompts` settings or a package manifest.

## Template Structure

### Basic Template

**Template File** (`prompts/review.md`):

```markdown
---
description: Review staged git changes
---

Review the staged changes (`git diff --cached`). Focus on:

- Bugs and logic errors
- Security issues
- Error handling gaps
```

**Usage**: `/review`

### Template with Arguments

**Template File** (`prompts/component.md`):

```markdown
---
description: Create a component
---

Create a React component named $1 with features: $@
```

**Usage**: `/component Button "onClick handler" "disabled support"`

### Template with Multiple Arguments and Slicing

**Template File** (`prompts/changelog.md`):

```markdown
---
description: Generate changelog entry
---

Create a changelog entry for version $1:

## [$1] - YYYY-MM-DD

### Added

- New feature: $2

### Changed

- Updated: $3

### Fixed

- Bug fix: $4
```

**Usage**: `/changelog 1.2.3 "User authentication" "Login flow" "Fix token refresh"`

## Common Template Patterns

### Review Pattern

```markdown
---
description: Review staged git changes
---

Review the staged changes (`git diff --cached`). Focus on:

- Bugs and logic errors
- Security issues
- Error handling gaps
```

### Component Pattern

```markdown
---
description: Create a component
---

Create a React component named $1 with features: $@
```

### Documentation Pattern

```markdown
---
description: Generate documentation
---

Generate documentation for $1, covering:

- Overview
- Features
- API reference
- Usage examples
```

### Testing Pattern

```markdown
---
description: Create test suite
---

Create comprehensive tests for $1 including:

- Unit tests
- Integration tests
- Edge cases
```

## Template Best Practices

### Use Clear Descriptions

```markdown
---
description: Create a component
---
```

Good: Describes what the template does and when to use it.

### Keep Templates Concise

Focus on the core pattern, not verbose explanations.

### Use Consistent Naming

- Use gerund form: `reviewing-changes`, `creating-components`
- Match the filename: `review.md`, `component.md`

### Avoid Magic Values

Use placeholders for values that will vary:

```markdown
---
description: Configure environment
---

Create environment configuration for $1 environment with:

- Database: $2
- API keys: $3
```

## Advanced Template Features

### Conditional Content

You can use JavaScript-style conditionals in templates:

```markdown
---
description: Conditional template
---

${$1 ? 'Feature enabled' : 'Feature disabled'}
```

### Multiple Sections

Templates can have multiple sections:

````markdown
---
description: Setup guide
---

# Setup Guide

## Prerequisites

${$1 ? 'Node.js 18+' : 'Node.js 16+'}

## Installation

```bash
npm install $1
```
````

## Configuration

Edit `config.json` with your settings.

````

## Template Loading and Caching

- Templates are loaded at startup
- Changes to template files trigger reload
- Templates are cached in memory for performance

## Template Troubleshooting

### Template Not Expanding

1. Check the filename matches the command
2. Verify the template is in a loaded location
3. Check for syntax errors in the template

### Arguments Not Working

1. Verify the argument syntax: `$1`, `$@`, etc.
2. Check that enough arguments are provided
3. Ensure arguments are passed correctly

### Autocomplete Not Showing Templates

1. Verify templates are in a loaded location
2. Check that the `description` field is present
3. Restart pi to refresh the template list

## Creating Custom Templates

### Using pi commands

```bash
# Create a new template
echo '---
description: My custom template
---
My custom template content
' > ~/.pi/agent/prompts/my-template.md

# Use the template
/pi-template
````

### Using a Package

Create a `prompts/` directory in your package:

```
my-package/
├── package.json
└── prompts/
    └── review.md
```

In `package.json`:

```json
{
  "name": "my-package",
  "pi": {
    "prompts": ["./prompts"]
  }
}
```

## Template and Skills Interaction

Templates can reference skills:

```markdown
---
description: Review with skill
---

First, apply the [code-review skill](/skill:code-review) to analyze the changes.
Then provide your assessment.
```

## Template and Extension Interaction

Extensions can inject templates into the session:

```typescript
pi.sendMessage({
  customType: "template",
  content: "Template content",
  details: { templateName: "my-template" },
});
```

## Security Considerations

- Templates can instruct the model to perform actions
- Be careful with templates that include executable code
- Validate template sources before use
- Use templates from trusted sources only

For more information, see the [pi-mono documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/prompt-templates.md).
