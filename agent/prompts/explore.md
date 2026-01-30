---
description: Explore and understand an unfamiliar codebase
---

Explore and understand this codebase.

<exploration_workflow>
1. **Overview**: Get high-level statistics and structure
2. **Entry Points**: Find main application entry points
3. **Architecture**: Understand layers and dependencies
4. **Key Patterns**: Identify coding patterns and conventions
</exploration_workflow>

<discovery_commands>
```bash
# Project statistics
cm stats . --format ai

# Directory structure
tree -L 2 -I 'node_modules|dist|.git|.next|.cache|coverage' .

# Code map (level 2 for overview)
cm map . --level 2 --format ai

# Find entry points
find . -name "main.*" -o -name "index.*" -o -name "app.*" | grep -v node_modules

# Check for existing documentation
cat README.md AGENTS.md CONTRIBUTING.md 2>/dev/null

# Understand dependencies
cat package.json | jq '.dependencies, .devDependencies' 2>/dev/null
```
</discovery_commands>

<architecture_analysis>
```bash
# Module dependencies
cm deps . --format ai

# Check for circular dependencies
cm deps . --circular --format ai

# Find public APIs
cm map . --level 2 --exports-only --format ai
```
</architecture_analysis>

<questions_to_answer>
- What is the main purpose of this project?
- What framework/runtime is used?
- How is the code organized (feature-based, layer-based)?
- What are the main entry points?
- What external services/APIs does it depend on?
- What testing framework is used?
- What are the build/run commands?
</questions_to_answer>

<output_format>
Provide a summary with:

### Overview
Brief description of what the project does

### Tech Stack
- Runtime/Framework
- Key dependencies
- Testing tools

### Architecture
- Directory structure explanation
- Main modules and their purposes
- Data flow

### Entry Points
- Main application entry
- API endpoints (if applicable)
- CLI commands (if applicable)

### Key Patterns
- Code organization
- Naming conventions
- Common patterns used
</output_format>
