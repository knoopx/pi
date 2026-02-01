---
description: Define prompt template for pi coding agent with best practices
---

Define prompt template for pi coding agent following best practices:

$@

# Workflow

1. Determine project root:
   a) if `~/.pi`, then place it under `~/.pi/agent/prompts/<name>`
   b) otherwise under `<project root>/.pi/templates`
2. Determine if an existing template exists:
   a) if so, incorporate changes
   b) create file
3. Define prompt template

# Pi Coding Agent Prompt Template

This template defines the structure and best practices for creating effective prompts for the pi coding agent.

## Template Structure

```
---
description: [Template name]
---

[Template content with placeholders]
```

## Best Practices

### 1. Clear Descriptions

Always include a clear, descriptive `description` field that explains what the template does and when to use it.

```markdown
---
description: Create a component
---
```

### 2. Concise Content

Focus on the core pattern and instructions. Avoid verbose explanations that add noise.

### 3. Consistent Naming

- Use gerund form for descriptions: `reviewing-changes`, `creating-components`
- Match the filename: `review.md`, `component.md`

### 4. Use Placeholders

Use `\$1`, `\$2`, etc. for variable values:

```markdown
---
description: Configure environment
---

Create environment configuration for \$1 environment with:

- Database: \$2
- API keys: \$3
```

## Common Patterns

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

### Documentation Pattern

```markdown
---
description: Generate documentation
---

Generate documentation for \$1, covering:

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

Create comprehensive tests for \$1 including:

- Unit tests
- Integration tests
- Edge cases
- Edge case: \$2
```

### Component Pattern

```markdown
---
description: Create a component
---

Create a [technology] component named \$1 with features: \$@
```

## Advanced Features

### Multiple Arguments and Slicing

```markdown
---
description: Generate changelog entry
---

Create a changelog entry for version \$1:

## [\$1] - YYYY-MM-DD

### Added

- New feature: \$2

### Changed

- Updated: \$3

### Fixed

- Bug fix: \$4
```

### Conditional Content

```markdown
---
description: Conditional template
---

\${\$1 ? 'Feature enabled' : 'Feature disabled'}
```

### Multiple Sections

````markdown
---
description: Setup guide
---

# Setup Guide

## Prerequisites

\${\$1 ? 'Node.js 18+' : 'Node.js 16+'}

## Installation

```bash
npm install \$1
```
````

## Configuration

Edit `config.json` with your settings.

```

## Template Loading Rules

- Templates loaded from: Global `~/.pi/agent/prompts/*.md`, Project `.pi/prompts/*.md`, Packages `prompts/` directories
- Template discovery in `prompts/` is non-recursive
- Changes trigger reload automatically
- Templates are cached for performance

## Usage

Type `/` followed by the template name in your editor. Autocomplete shows available templates with descriptions.

```

/review # Expands review.md
/component Button # Expands with argument
/component Button "click handler" # Multiple arguments

````

## Arguments Syntax

- `\$1`, `\$2`, ... - Positional arguments
- `\$@` or `\$ARGUMENTs` - All arguments joined
- `\${@:N}` - Args from Nth position (1-indexed)
- `\${@:N:L}` - L args starting at N

## Template and Skills Interaction

Templates can reference skills:

```markdown
---
description: Review with skill
---

First, apply the [code-review skill](/skill:code-review) to analyze the changes.
Then provide your assessment.
````

## Security Considerations

- Templates can instruct the model to perform actions
- Be careful with templates that include executable code
- Validate template sources before use
- Use templates from trusted sources only

## Custom Template Creation

### Using CLI

```bash
echo '---
description: My custom template
---
My custom template content
' > ~/.pi/agent/prompts/my-template.md

# Use the template
/pi-template
```

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

## Troubleshooting

### Template Not Expanding

1. Check filename matches command
2. Verify template is in loaded location
3. Check for syntax errors

### Arguments Not Working

1. Verify syntax: `\$1`, `\$@`, etc.
2. Check arguments provided correctly
3. Ensure arguments passed as strings

### Autocomplete Not Showing

1. Verify templates in loaded location
2. Check `description` field present
3. Restart pi to refresh

## Template Metadata

- Filename becomes command name (without `.md`)
- `description` is optional; if missing, first non-empty line is used
- Templates support YAML frontmatter for metadata
- Can include tags for categorization

## Example: Advanced AI Agent Prompt

```markdown
---
description: Define AI agent prompt
tags: [ai, agent, prompt]
---

# AI Agent Prompt Template

## System Instructions

Act as an expert [domain] assistant specializing in:

- [Specialization 1]
- [Specialization 2]
- [Specialization 3]

## Response Format

- Use markdown formatting
- Include code blocks for examples
- Add documentation links when relevant
- Provide clear explanations

## Task

[Main task description with \$1 and \$2 placeholders]

## Constraints

- [Constraint 1]
- [Constraint 2]
- [Constraint 3]

## Workflow

1. [Step 1]
2. [Step 2]
3. [Step 3]
```

This template provides a foundation for creating effective prompts for the pi coding agent, following all established best practices and patterns.
