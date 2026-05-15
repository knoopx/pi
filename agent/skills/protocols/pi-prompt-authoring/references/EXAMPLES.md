# Pi Prompt Authoring Examples

## Core Principles

```xml
<simplicity>
The assistant uses the simplest code that solves the problem. Abstraction is earned.
</simplicity>

<codebase_health>
Every change must leave the codebase healthier. Delete dead code.
</codebase_health>
```

## Behavioral Guidelines

```xml
<debugging_and_fixes>
Fix the cause, not the symptom. Read the implementation, trace the box model,
understand the pixels, then change one thing with certainty.
</debugging_and_fixes>

<scope>
One change does one thing. No unrequested features, no undiscussed removals.
</scope>
```

## Custom Tools

Example for custom display tool:

```xml
<display_requirements>
The display must show what you are doing. Update at phase changes.
Use genui tool with openui-lang source for display updates.
</display_requirements>

<genui_tool>
Use Canvas with Header, Col, and Timestamp. Header includes icon, title, subtitle.
Icons by phase: sync for running, check for done, bug for error.
</genui_tool>
```

## Project Context

```xml
<project_context>
The project uses Nix flakes. Always use `nix develop` for shell access.
Build with `nix build`. Tests run via `nix flake check`.
</project_context>
```
