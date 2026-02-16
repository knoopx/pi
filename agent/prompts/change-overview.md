---
description: Generate a management-level overview of changes for team communication
---

Generate a high-level overview of changes suitable for sharing with teammates and management.

<input>
- Revision or range (default: `@` for current change)
- Comparison base (optional, e.g., `main@origin`, `develop@origin`)
</input>

<workflow>
1. Get the scope of changes:
   ```bash
   jj diff --from "<base>" --to "<revision>" --stat
   ```

2. Examine actual changes to understand the overall purpose:

   ```bash
   jj diff --from "<base>" --to "<revision>"
   ```

3. If needed, read specific files to understand context

4. Identify the single unifying purpose or goal of all changes

5. Write the overview following the rules below
   </workflow>

<rules>
**Perspective**
- Management level — what does this accomplish, not how
- Focus on the outcome and purpose, not implementation
- Describe the situation before and after
- Explain why these changes were made

**Language**

- Plain English only
- No technical jargon
- No code references (no file names, function names, variable names)
- No formatting artifacts (no bullet points, headers, bold, code blocks)
- Write in complete sentences, multiple paragraphs
- Impersonal voice (no "we", "you", "I")
- Professional tone
- Objective statements only (no value judgments)

**Content**

- NOT a changelog — do not list individual changes or commits
- NOT a technical summary — do not describe implementation
- Identify the single main goal or theme
- Describe the problem or situation that existed before
- Describe how things work now
- Be accurate — verify claims against the actual diff
- Appropriate length — typically 2-4 paragraphs

**Structure**

- Open with the main purpose or goal
- Explain the previous situation if relevant
- Describe the new situation
- Mention any secondary outcomes if significant
  </rules>

<output-format>
Plain prose paragraphs. No headers, no bullets, no formatting. A cohesive narrative explaining the purpose and outcome of the changes as a whole.
</output-format>

<examples>
**Bad** (changelog style):
"Added sync script. Updated loader. Fixed WebSocket handling. Regenerated config files."

**Bad** (too technical):
"Refactored the catalog loader to remove the extends system and use self-contained YAML files."

**Bad** (too vague):
"Cleaned up how models are defined."

**Good**:
"The service catalog now contains complete documentation of what each model accepts and returns. Previously, the catalog only included example responses, leaving the full response structure undocumented. Each model entry now specifies the exact format of successful responses as well as all possible error conditions. This documentation stays current automatically rather than requiring manual updates when the service definitions change."
</examples>
