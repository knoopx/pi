# Skill Authoring Best Practices

Skills are filesystem-based resources that provide domain-specific expertise. They package instructions, metadata, and optional resources (scripts, templates) that pi uses automatically when relevant.

## How Skills Load (Progressive Disclosure)

Skills load content in three levels to minimize context usage:

| Level               | When Loaded      | Token Cost  | Content                                    |
| ------------------- | ---------------- | ----------- | ------------------------------------------ |
| **1: Metadata**     | Always (startup) | ~100 tokens | `name` and `description` from YAML         |
| **2: Instructions** | When triggered   | <5k tokens  | SKILL.md body                              |
| **3: Resources**    | As needed        | Unlimited   | Bundled files, scripts (executed via bash) |

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

````

**Bad** (~150 tokens):
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available...
````

### Match Specificity to Task Fragility

| Freedom Level                     | Use When                                     | Example                           |
| --------------------------------- | -------------------------------------------- | --------------------------------- |
| **High** (text guidance)          | Multiple valid approaches, context-dependent | Code review process               |
| **Medium** (pseudocode/templates) | Preferred pattern exists, some variation OK  | Report generation with parameters |
| **Low** (exact scripts)           | Fragile operations, consistency critical     | Database migrations               |

## Skill Structure

### Directory Structure

```
skill-name/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
│   └── process.sh
├── references/           # Detailed docs loaded on-demand
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md Format

````markdown
---
name: my-skill
description: What this skill does and when to use it. Be specific.
---

# My Skill

## Setup

Run once before first use:

```bash
cd /path/to/skill && npm install
```
````

## Usage

```bash
./scripts/process.sh <input>
```

````

Use relative paths from the skill directory:

```markdown
See [the reference guide](references/REFERENCE.md) for details.
````

## Frontmatter

Per the [Agent Skills specification](https://agentskills.io/specification#frontmatter-required):

| Field                      | Required | Description                                                                    |
| -------------------------- | -------- | ------------------------------------------------------------------------------ |
| `name`                     | Yes      | Max 64 chars. Lowercase a-z, 0-9, hyphens. Must match parent directory.        |
| `description`              | Yes      | Max 1024 chars. What the skill does and when to use it.                        |
| `license`                  | No       | License name or reference to bundled file.                                     |
| `compatibility`            | No       | Max 500 chars. Environment requirements.                                       |
| `metadata`                 | No       | Arbitrary key-value mapping.                                                   |
| `allowed-tools`            | No       | Space-delimited list of pre-approved tools (experimental).                     |
| `disable-model-invocation` | No       | When `true`, skill is hidden from system prompt. Users must use `/skill:name`. |

### Name Rules

- 1-64 characters
- Lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- No consecutive hyphens
- Must match parent directory name

Valid: `pdf-processing`, `data-analysis`, `code-review`
Invalid: `PDF-Processing`, `-pdf`, `pdf--processing`

### Description Best Practices

The description determines when the agent loads the skill. Be specific.

Good:

```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

Poor:

```yaml
description: Helps with PDFs.
```

## Loading Locations

Pi loads skills from:

- Global: `~/.pi/agent/skills/`
- Project: `.pi/skills/`
- Packages: `skills/` directories or `pi.skills` entries in `package.json`
- Settings: `skills` array with files or directories
- CLI: `--skill <path>` (repeatable, additive even with `--no-skills`)

Discovery rules:

- Direct `.md` files in the skills directory root
- Recursive `SKILL.md` files under subdirectories

Disable discovery with `--no-skills` (explicit `--skill` paths still load).

### Using Skills from Other Harnesses

To use skills from Claude Code or OpenAI Codex, add their directories to settings:

```json
{
  "skills": ["~/.claude/skills", "~/.codex/skills"]
}
```

## Skill Commands

Skills register as `/skill:name` commands:

```bash
/skill:brave-search           # Load and execute the skill
/skill:pdf-tools extract      # Load skill with arguments
```

Arguments after the command are appended to the skill content as `User: <args>`.

Toggle skill commands via `/settings` in interactive mode or in `settings.json`:

```json
{
  "enableSkillCommands": true
}
```

## Progressive Disclosure

SKILL.md is a table of contents that points to detailed materials. Pi loads referenced files only when needed.

### Reference Pattern

```markdown
# PDF Processing

## Quick start

[Basic instructions here]

## Advanced features

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

````

### Examples Pattern

Provide input/output pairs:

```markdown
## Commit message format

**Example:**
Input: Added user authentication
Output:
````

feat(auth): implement JWT authentication

```

```

### Workflow Pattern

Break complex tasks into steps with checklists:

```markdown
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
```

### Feedback Loop Pattern

```markdown
## Edit process

1. Make edits
2. **Validate**: `python validate.py`
3. If fails → fix and repeat step 2
4. Only proceed when validation passes
```

## Anti-Patterns to Avoid

| Anti-Pattern        | Problem          | Solution                          |
| ------------------- | ---------------- | --------------------------------- |
| Too verbose         | Wastes tokens    | Assume agent knows basics         |
| Too many options    | Confusing        | Provide default with escape hatch |
| Time-sensitive info | Becomes wrong    | Use "old patterns" section        |
| Inconsistent terms  | Confuses agent   | Pick one term, use consistently   |
| Windows paths       | Breaks on Unix   | Always use forward slashes        |
| Vague descriptions  | Poor discovery   | Include what AND when             |
| Deep nesting        | Incomplete reads | Keep refs one level deep          |

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

## Validation

Pi validates skills against the Agent Skills standard. Most issues produce warnings but still load the skill:

- Name doesn't match parent directory
- Name exceeds 64 characters or contains invalid characters
- Name starts/ends with hyphen or has consecutive hyphens
- Description exceeds 1024 characters
- Unknown frontmatter fields

**Exception:** Skills with missing description are not loaded.

Name collisions (same name from different locations) warn and keep the first skill found.

## Example

```
brave-search/
├── SKILL.md
├── search.js
└── content.js
```

**SKILL.md:**

````markdown
---
name: brave-search
description: Web search and content extraction via Brave Search API. Use for searching documentation, facts, or any web content.
---

# Brave Search

## Setup

```bash
cd /path/to/brave-search && npm install
```
````

## Search

```bash
./search.js "query"              # Basic search
./search.js "query" --content    # Include page content
```

## Extract Page Content

```bash
./content.js https://example.com
```

```

## Skill Repositories

- [Anthropic Skills](https://github.com/anthropics/skills) - Document processing (docx, pdf, pptx, xlsx), web development
- [Pi Skills](https://github.com/badlogic/pi-skills) - Web search, browser automation, Google APIs, transcription

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

## Advanced Topics

### Skills with Multiple Languages

Skills can include code in multiple languages:

```

my-skill/
├── SKILL.md
├── scripts/
│ ├── setup.sh
│ ├── setup.py
│ └── setup.js
└── templates/
├── config.yaml
└── config.json

````

### Skills with Dependencies

Declare npm dependencies in SKILL.md:

```yaml
---
name: my-skill
description: My skill
dependencies:
  - axios
  - lodash
  - openai
---
````

### Conditional Execution

Use the `allowed-tools` field to limit tool usage:

```yaml
---
name: secure-skill
description: Secure skill
allowed-tools: bash read write edit
---
```

For more information, see the [pi-mono documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/skills.md).
