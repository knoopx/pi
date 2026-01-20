# No Cowboys in This Town Extension

An extension that enforces proper code analysis before allowing file modifications.

## Installation

No additional installation required.

## Description

This extension prevents "cowboy coding" by blocking file editing operations (`edit` and `write` tools) until at least one context-grounding tool has been used in the session.

Context-grounding tools include:
- `code-map` - Create hierarchical code structure overview
- `code-query` - Search for functions, classes, and symbols
- `code-inspect` - Examine specific file structure
- `code-callers` - Find function callers
- `code-callees` - Find function callees
- `code-trace` - Trace call paths between functions
- `code-deps` - Analyze dependencies

## Usage

Once installed, the extension automatically:
1. Tracks usage of grounding tools in each session
2. Blocks `edit` and `write` tool calls until grounding is complete
3. Allows normal coding workflow after proper context gathering

This encourages developers to understand the codebase before making changes, reducing errors and improving code quality.

## Behavior

- **Session Start**: Grounding state is reset for each new session
- **Tool Results**: Using any grounding tool marks the session as "grounded"
- **Tool Calls**: File editing tools are blocked with a helpful message until grounding is complete