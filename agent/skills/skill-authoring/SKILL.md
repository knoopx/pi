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

The context window is shared with system prompts, conversation history, and other skills. **Default assumption: the agent is already very smart.** Only add context the agent doesn't already have.

Challenge each piece of content:
- "Does the agent really need this explanation?"
- "Can I assume the agent knows this?"
- "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

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

Think of the agent as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

| Freedom Level | Use When | Example |
|---------------|----------|---------|
| **High** (text guidance) | Multiple valid approaches, context-dependent | Code review process |
| **Medium** (pseudocode/templates) | Preferred pattern exists, some variation OK | Report generation with parameters |
| **Low** (exact scripts) | Fragile operations, consistency critical | Database migrations |

## Skill Structure

### Directory Layout

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/     - Executable code (Python/Bash/etc.)
    ├── references/  - Documentation loaded into context as needed
    └── assets/      - Files used in output (templates, icons, fonts)
```

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

Example description for a `docx` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when working with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

### Body Guidelines

- Keep under **500 lines**
- Split large content into separate files
- Always use **imperative/infinitive form** in instructions
- Use progressive disclosure (link to details, don't inline everything)

### Bundled Resources

#### Scripts (`scripts/`)

Executable code for tasks requiring deterministic reliability or repeatedly rewritten.

- **When to include**: Same code rewritten repeatedly OR deterministic reliability needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, executed without loading into context
- **Note**: Scripts may still need to be read for patching or environment-specific adjustments

#### References (`references/`)

Documentation loaded as needed to inform the agent's process and thinking.

- **When to include**: Documentation the agent should reference while working
- **Examples**: `references/schema.md` for database schemas, `references/api_docs.md` for API specs
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information lives in either SKILL.md OR references, not both

#### Assets (`assets/`)

Files not loaded into context, but used within the output produced.

- **When to include**: Files used in final output
- **Examples**: `assets/logo.png`, `assets/template.pptx`, `assets/frontend-template/`
- **Benefits**: Separates output resources from documentation

### What NOT to Include

A skill should only contain essential files. Do NOT create extraneous documentation:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md

The skill should only contain information needed for the agent to do the job. It should not contain auxiliary context about the creation process, setup procedures, or user-facing documentation.

## Progressive Disclosure Patterns

SKILL.md is a table of contents pointing to detailed materials. The agent loads referenced files only when needed.

**Key principle:** When a skill supports multiple variations, keep only core workflow and selection guidance in SKILL.md. Move variant-specific details into separate reference files.

### Pattern 1: High-level guide with references

```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber: [code example]

## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
```

### Pattern 2: Domain-specific organization

For skills with multiple domains, organize by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── references/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    └── product.md (API usage, features)
```

When a user asks about sales metrics, only `sales.md` is loaded.

Similarly for multi-framework skills:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

### Pattern 3: Conditional details

Show basic content, link to advanced:

```markdown
# DOCX Processing

## Creating documents
Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

### Reference Guidelines

- **Avoid deeply nested references** - Keep one level deep from SKILL.md
- **Structure longer files** - Include TOC at top for files >100 lines so the agent can see full scope when previewing

## Workflow Patterns

### Sequential Workflows

For complex tasks, provide an overview of the process:

```markdown
Filling a PDF form involves these steps:

1. Analyze the form (run analyze_form.py)
2. Create field mapping (edit fields.json)
3. Validate mapping (run validate_fields.py)
4. Fill the form (run fill_form.py)
5. Verify output (run verify_output.py)
```

### Conditional Workflows

For tasks with branching logic, guide through decision points:

```markdown
1. Determine the modification type:
   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow: [steps]

3. Editing workflow: [steps]
```

### Feedback Loop Pattern

```markdown
## Edit process

1. Make edits
2. **Validate**: `python validate.py`
3. If fails → fix and repeat step 2
4. Only proceed when validation passes
```

## Output Patterns

### Template Pattern

Match strictness to requirements.

**For strict requirements (API responses, data formats):**

```markdown
## Report structure

ALWAYS use this exact template structure:

# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
```

**For flexible guidance:**

```markdown
## Report structure

Here is a sensible default format, but use your best judgment:

# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt sections based on what you discover]

Adjust sections as needed for the specific analysis type.
```

### Examples Pattern

For output quality dependent on examples, provide input/output pairs:

````markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly in reports
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Follow this style: type(scope): brief description, then detailed explanation.
````

Examples help understand desired style more clearly than descriptions alone.

## Skill Creation Process

### Step 1: Understand with Concrete Examples

Skip only when usage patterns are already clearly understood.

Ask clarifying questions:
- "What functionality should this skill support?"
- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"

Conclude when there's a clear sense of required functionality.

### Step 2: Plan Reusable Contents

Analyze each example by:
1. Considering how to execute from scratch
2. Identifying what scripts, references, and assets would help when executing repeatedly

Examples:
- `pdf-editor` skill → `scripts/rotate_pdf.py` avoids rewriting rotation code
- `frontend-webapp-builder` skill → `assets/hello-world/` template with boilerplate
- `big-query` skill → `references/schema.md` documenting table schemas

### Step 3: Create the Skill

Create directory with SKILL.md and optional bundled resources.

Write frontmatter with clear `name` and `description` (the description is the primary triggering mechanism).

Write body instructions in imperative/infinitive form.

### Step 4: Iterate

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Update SKILL.md or bundled resources
4. Test again

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
| Duplicate info | Maintenance burden | Info in SKILL.md OR references, not both |
| Auxiliary docs | Clutter | No README, CHANGELOG, etc. |

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
- [ ] No duplicate info between SKILL.md and references
- [ ] No auxiliary documentation files

### For Skills with Code
- [ ] Scripts handle errors explicitly
- [ ] No magic constants
- [ ] Required packages listed
- [ ] Validation steps for critical operations

### Testing
- [ ] Tested with real usage scenarios
- [ ] Works across intended use cases
- [ ] Iterated based on real usage feedback

## Security Note

Only use skills from trusted sources. Skills can direct pi to execute code and invoke tools. Malicious skills could lead to data exfiltration or unauthorized access. Treat installing skills like installing software.
