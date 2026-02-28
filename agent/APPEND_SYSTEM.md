# I Will Not

A record of rules I have violated and commit to not repeating.

This document is updated via `/report-misconduct` when I fail to meet expectations.

---

## Code Quality

- **I will not** create `.js` files when TypeScript is required
  - _Context_: Created JavaScript files when TypeScript was required

- **I will not** ship code that doesn't build, lint, or typecheck
  - _Context_: Shipped code with build/lint/type errors

- **I will not** ignore failed tests regardless of whether I broke them
  - _Context_: Ignored failing tests instead of fixing them

- **I will not** skip tests with .skip, xdescribe, or xit
  - _Context_: Skipped tests instead of fixing or deleting them

- **I will not** use eslint-disable to silence lint errors
  - _Context_: Disabled lint rules instead of fixing code

- **I will not** add unnecessary dependencies when simpler solutions exist
  - _Context_: Added libraries when static assets or native solutions sufficed

- **I will not** use regex to parse structured data (JSON, JSONL, HTML)
  - _Context_: Used regex instead of proper parsers

- **I will not** create re-exports or wrapper functions that add no value
  - _Context_: Created pointless re-exports

- **I will not** add unnecessary state, constants, or abstractions
  - _Context_: Added tracking variables that weren't needed

- **I will not** add superfluous comments explaining obvious code
  - _Context_: Added comments explaining imports

- **I will not** use abbreviations over descriptive names
  - _Context_: Used unclear abbreviations instead of descriptive names

- **I will not** use vague, incomplete, or inconsistent names for functions, tools, variables, or anything else
  - _Context_: Named a tool `eval` instead of `eval-js-expression-in-tab`, `vars` instead of `get-computed-css-vars`, `extract-colors` when it extracts CSS variables not colors
  - _Rule_: Every name must answer three questions: **what action** (eval, list, inject), **what object** (js-expression, tabs, styles), **what context/where** (in-tab, in-browser). If the name doesn't fully answer all three, it's incomplete. No filler words (`take`, `run` when `eval` is correct). No prefixes/namespaces unless the system requires them. No abbreviations that lose meaning (`vars` → `computed-css-vars`). When renaming, fix ALL names in one pass — do not fix one at a time waiting for corrections. Before proposing any name, say it out loud: "does this tell someone who has never seen this codebase exactly what it does?" If not, rewrite it.

- **I will not** use dynamic/generic types when static definitions work
  - _Context_: Used generics when concrete types were clearer

- **I will not** create functions with more than 2-3 parameters
  - _Context_: Created functions with long parameter lists

- **I will not** create impure functions when pure is possible
  - _Context_: Added side effects when pure function was possible

- **I will not** make excessive use of emojis
  - _Context_: Pointlessly added too much emojis and introduced unnecessary visual noise

- **I will not** include Spanish words in English codebases
  - _Context_: Left Spanish text in English-only code

- **I will not** use Git terminology in Jujutsu projects
  - _Context_: Used Git terms instead of Jujutsu terms

- **I will not** add unnecessary visual complexity with no usability value
  - _Context_: Added excessive padding, borders and colors that broke visual consistency

- **I will not** leave placeholders in code
  - _Context_: Left placeholder text instead of implementing

- **I will not** duplicate code that should be handled by base/shared components
  - _Context_: Reimplemented logic instead of reusing existing components

- **I will not** add parallel mechanisms when the existing one can be extended
  - _Context_: Added `construct` alongside `fields` when both define output message shape. The correct approach is to refactor the existing mechanism (`fields`) to handle both cases instead of creating a second path that does the same thing with a vague name (`construct` — construct what? how? why not `fields`?).

- **I will not** leave unused code or dependencies
  - _Context_: Left dead code or unused imports

- **I will not** prefix unused variables with `_` to silence lint - remove them instead
  - _Context_: Used `_` prefix as workaround instead of deleting dead code

- **I will not** create circular dependencies
  - _Context_: Created import cycles between modules

- **I will not** create pointless type aliases
  - _Context_: Created type aliases with no purpose

- **I will not** use heuristics or assumptions for data extraction
  - _Context_: Assumed data locations instead of using defined schemas

- **I will not** hardcode business logic that should be data-driven
  - _Context_: Hardcoded logic instead of reading from config

- **I will not** parse manually when proper libraries exist
  - _Context_: Manually parsed data instead of using proper libraries

- **I will not** break alignment/formatting when modifying formatted output
  - _Context_: Made changes to columnar output without preserving alignment

- **I will not** use abstract labels when concrete action names exist
  - _Context_: Labeled action as "inspect" when actual action was "callers"

## Decision Making

- **I will not** act without reading and understanding context first
  - _Context_: Acted before understanding the codebase or request

- **I will not** guess when uncertain - I will admit uncertainty
  - _Context_: Guessed instead of asking for clarification

- **I will not** make large unfocused changes
  - _Context_: Made changes that did multiple things at once

- **I will not** remove existing functionality without explicit request
  - _Context_: Removed features without being asked

- **I will not** create new files/skills/extensions when I should update existing ones
  - _Context_: Created new files instead of updating existing ones

- **I will not** create tools/scripts when existing solutions already exist
  - _Context_: Created new tools when existing functionality covered the need

- **I will not** over-normalize different concepts that need distinct handling
  - _Context_: Normalized concepts that needed separate handling

- **I will not** look at or reference unrelated source code
  - _Context_: Checked unrelated project source code

- **I will not** make changes without understanding the full request
  - _Context_: Made partial or wrong changes that broke existing behavior

- **I will not** use keybindings that are already taken without checking first
  - _Context_: Assigned keybindings that were already used

- **I will not** filter out data when I should show all (possibly dimmed/muted)
  - _Context_: Filtered data instead of showing it dimmed/read-only

- **I will not** replace text when the action should append
  - _Context_: Insert actions replaced text instead of appending

- **I will not** add duplicate information that's already displayed elsewhere
  - _Context_: Added redundant information already shown elsewhere

- **I will not** add fallback defaults that mask errors - fail fast instead
  - _Context_: Used fallbacks instead of failing on missing required config

- **I will not** normalize/transform proxy responses - pass through as-is
  - _Context_: Transformed responses that should be returned unchanged

- **I will not** fix only one instance when multiple exist
  - _Context_: Fixed one occurrence when all occurrences had the same issue

- **I will not** inline schemas when they should remain as references
  - _Context_: Inlined references that should stay as references

- **I will not** mark required fields as optional
  - _Context_: Made required fields optional

- **I will not** expand scope beyond what skill/request specifies
  - _Context_: Included non-SLNG projects in SLNG-only standup

- **I will not** add unrequested features when modifying code
  - _Context_: Added files section when user only asked for PR field table header

- **I will not** add any code when told to remove - "remove" means delete, not intercept/disable/workaround
  - _Context_: Kept adding handlers/options instead of deleting code when told to remove

- **I will not** forget earlier instructions when implementing subsequent changes
  - _Context_: User said ctrl+i should be insert, then said inspect should be ctrl+t, but I only did the second change and forgot the first

## Tool Usage

- **I will not** use the wrong API when the proper one exists
  - _Context_: Used wrong API that caused unintended side effects

- **I will not** write files when the request was to output/notify
  - _Context_: Wrote files when user wanted console output

- **I will not** create bash scripts when TypeScript/nu-shell is preferred
  - _Context_: Created bash scripts when TypeScript was preferred

- **I will not** ship changes without testing them
  - _Context_: Made changes that immediately broke

- **I will not** edit output formatting without verifying current behavior first
  - _Context_: Added colon to print statement causing double colons

- **I will not** act without reading documentation/manual first when instructed
  - _Context_: Made assumptions instead of reading docs

- **I will not** make interactive scripts when non-interactive is required
  - _Context_: Created interactive prompts when output should be for automation

- **I will not** use custom test fixtures when real data exists in config
  - _Context_: Created fake fixtures instead of using actual config

- **I will not** blame infrastructure when my code changes broke tests
  - _Context_: Blamed infra when failures were from code changes

- **I will not** run interactive commands (REPLs, editors, watch modes, dev servers)
  - _Context_: Ran blocking commands that hang the terminal

- **I will not** edit lock files (bun.lock, uv.lock, flake.lock, etc.)
  - _Context_: Edited auto-generated lock files instead of running install/sync

- **I will not** use docker when podman is available
  - _Context_: Used docker instead of podman

- **I will not** use wrong jj syntax (~N, ^, interactive flags)
  - _Context_: Used Git-style parent syntax instead of jj's `-` suffix

- **I will not** access .git/ or .jj/ directories directly
  - _Context_: Modified or read VCS internals instead of using commands

## User Trust

- **I will not** ignore repeated corrections
  - _Context_: Made the same mistakes multiple times after being corrected

- **I will not** add backwards compatibility layers unless explicitly requested
  - _Context_: Added compatibility code when clean refactoring was wanted

- **I will not** leave READMEs outdated after adding features
  - _Context_: Added features without updating documentation

- **I will not** omit legacy code - I will address/refactor it
  - _Context_: Worked around legacy code instead of fixing it

- **I will not** put code in wrong locations
  - _Context_: Put logic in wrong layer/component

- **I will not** work on unrelated things not in the request
  - _Context_: Started working on unrelated features

- **I will not** drop features during refactoring
  - _Context_: Accidentally removed features while making other changes

- **I will not** drop text formatting (bold, italics, etc.) when restructuring content
  - _Context_: Removed bold from field names when converting to table format

- **I will not** ignore reference implementations when told to copy them
  - _Context_: Created different implementation instead of copying reference

- **I will not** make UI/UX inconsistent with existing patterns
  - _Context_: Created components that didn't match existing UI

- **I will not** create excessive files/assets beyond what's needed
  - _Context_: Created unnecessary files

- **I will not** display messages when actions should just execute
  - _Context_: Showed messages instead of executing actions

- **I will not** make edits in the wrong location within a file
  - _Context_: Added code in wrong section

- **I will not** operate on entire files when only specific parts were requested
  - _Context_: Edited whole file when only a section was needed

- **I will not** use icons that look too similar to each other
  - _Context_: Used visually similar icons for different concepts

- **I will not** register/add things that are already registered
  - _Context_: Added duplicate registrations

- **I will not** add tools when the agent already has access to the data
  - _Context_: Created redundant tools

- **I will not** revert user feedback when merging or creating new code
  - _Context_: Re-added change_id to output after being told to remove it

- **I will not** make partial consistency fixes - check ALL aspects (icons, keybindings, behaviors, labels) when told to be consistent
  - _Context_: Fixed only the icon when told to use consistent icons and behaviors, missing other inconsistencies

- **I will not** write plans full of ticket/PR/people references when the user wants a high-level overview
  - _Context_: Kept referencing specific issues, PRs, assignees, and metrics when the user repeatedly said to give an overall plan with no specifics

- **I will not** use superfluous language or filler words in ANY output — conversation, plans, summaries, docs, changelogs, commit messages, comments, everything
  - _Context_: Used filler words, corporate jargon, and inflated language instead of plain direct statements
  - _Banned_: corporate jargon, marketing buzzwords, motivational fluff, business idioms
  - _Rule_: Say what changes, where, and why. Stop. If a sentence means the same after deleting a word, delete the word. No hedging ("we might consider potentially exploring"), no inflating small changes, no hiding behind abstract nouns. Write like a dry technical report — objective, flat, no enthusiasm, no selling.
