---
name: skill-authoring
description: Write effective pi skills with proper structure, concise content, and progressive disclosure. Use when creating new skills, improving existing skills, or reviewing skill quality.
---

# Skill Authoring Best Practices

Skills are filesystem-based resources that provide domain-specific expertise. They package instructions, metadata, and optional resources (scripts, templates) that pi uses automatically when relevant.

## How Skills Load (Progressive Disclosure)

Skills load content in three levels to minimize context usage:

| Level | When Loaded | Token Cost | Content |
|-------|-------------|------------|---------|
| **1: Metadata** | Always (startup) | ~100 tokens | `name` and `description` from YAML |
| **2: Instructions** | When triggered | <5k tokens | SKILL.md body |
| **3: Resources** | As needed | Unlimited | Bundled files, scripts (executed via bash) |

This means you can install many skills without context penalty. Only relevant content enters the context window when pi reads the skill.

## Core Principles

### Conciseness is Critical

The context window is shared with system prompts, conversation history, and other skills. Challenge each piece of content:

- "Does the agent really need this explanation?"
- "Can I assume the agent knows this?"
- "Does this paragraph justify its token cost?"

**Good** (~50 tokens):
````markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**Bad** (~150 tokens):
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available...
```

### Match Specificity to Task Fragility

| Freedom Level | Use When | Example |
|---------------|----------|---------|
| **High** (text guidance) | Multiple valid approaches, context-dependent | Code review process |
| **Medium** (pseudocode/templates) | Preferred pattern exists, some variation OK | Report generation with parameters |
| **Low** (exact scripts) | Fragile operations, consistency critical | Database migrations |

## Skill Structure

### YAML Frontmatter

```yaml
---
name: processing-pdfs          # lowercase, hyphens, max 64 chars
description: Extract text and tables from PDFs, fill forms. Use when working with PDF files or document extraction.
---
```

**Name conventions** (prefer gerund form):
- `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`
- Avoid: `helper`, `utils`, `tools`, vague names

**Description requirements**:
- Write in **third person** (not "I can help" or "You can use")
- Include **what** it does AND **when** to use it
- Include key trigger terms for discovery
- Max 1024 characters

### Body Guidelines

- Keep under **500 lines**
- Split large content into separate files
- Use progressive disclosure (link to details, don't inline everything)

## Progressive Disclosure

SKILL.md is a table of contents that points to detailed materials. Pi loads referenced files only when needed.

### Directory Structure

```
skill-name/
├── SKILL.md              # Overview (loaded when triggered)
├── REFERENCE.md          # API details (loaded as needed)
├── EXAMPLES.md           # Usage examples (loaded as needed)
└── scripts/
    └── validate.py       # Utility script (executed, not loaded)
```

### Reference Pattern

```markdown
# PDF Processing

## Quick start
[Basic instructions here]

## Advanced features
**Form filling**: See [FORMS.md](FORMS.md)
**API reference**: See [REFERENCE.md](REFERENCE.md)
```

### Keep References One Level Deep

**Bad** (too deep):
```
SKILL.md → advanced.md → details.md → actual info
```

**Good** (one level):
```
SKILL.md → advanced.md (complete info)
SKILL.md → reference.md (complete info)
```

### Table of Contents for Long Files

For files >100 lines, include TOC at top so pi can see scope even with partial reads:

```markdown
# API Reference

## Contents
- Authentication
- Core methods
- Error handling
- Examples
```

## Content Patterns

### Template Pattern

````markdown
## Report structure

Use this template:

```markdown
# [Title]

## Executive summary
[Overview]

## Key findings
- Finding with data
```
````

### Examples Pattern

Provide input/output pairs:

````markdown
## Commit message format

**Example:**
Input: Added user authentication
Output:
```
feat(auth): implement JWT authentication
```
````

### Workflow Pattern

Break complex tasks into steps with checklists:

````markdown
## Processing workflow

```
Progress:
- [ ] Step 1: Analyze input
- [ ] Step 2: Validate data
- [ ] Step 3: Process
- [ ] Step 4: Verify output
```

**Step 1: Analyze input**
Run: `python scripts/analyze.py input.pdf`
````

### Feedback Loop Pattern

```markdown
## Edit process

1. Make edits
2. **Validate**: `python validate.py`
3. If fails → fix and repeat step 2
4. Only proceed when validation passes
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Too verbose | Wastes tokens | Assume agent knows basics |
| Too many options | Confusing | Provide default with escape hatch |
| Time-sensitive info | Becomes wrong | Use "old patterns" section |
| Inconsistent terms | Confuses agent | Pick one term, use consistently |
| Windows paths | Breaks on Unix | Always use forward slashes |
| Vague descriptions | Poor discovery | Include what AND when |
| Deep nesting | Incomplete reads | Keep refs one level deep |

## Executable Scripts

When including utility scripts:

### Solve, Don't Punt

Handle errors in scripts rather than failing:

```python
def process_file(path):
    try:
        return open(path).read()
    except FileNotFoundError:
        print(f"Creating {path}")
        open(path, 'w').write('')
        return ''
```

### Document Constants

```python
# HTTP requests typically complete within 30 seconds
REQUEST_TIMEOUT = 30  # Not magic number 47
```

### Make Execution Intent Clear

- "Run `analyze.py` to extract fields" (execute)
- "See `analyze.py` for the algorithm" (read as reference)

## Quality Checklist

### Core Quality
- [ ] Description includes what AND when
- [ ] Description written in third person
- [ ] Body under 500 lines
- [ ] No time-sensitive info
- [ ] Consistent terminology
- [ ] Concrete examples
- [ ] References one level deep

### For Skills with Code
- [ ] Scripts handle errors explicitly
- [ ] No magic constants
- [ ] Required packages listed
- [ ] Validation steps for critical operations

### Testing
- [ ] Tested with real usage scenarios
- [ ] Works across intended use cases

## Security Note

Only use skills from trusted sources. Skills can direct pi to execute code and invoke tools. Malicious skills could lead to data exfiltration or unauthorized access. Treat installing skills like installing software.
