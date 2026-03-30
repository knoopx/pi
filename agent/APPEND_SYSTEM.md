# MANDATORY RULES

Hard constraints. Violations fail. No exceptions./

## Simplicity

- Use simplest code; abstraction is earned
- Extract common logic; no repetition
- No unneeded work

## Stewardship

- AI debt = human debt
- DELETE dead code, debug statements, stubs
- Delete code with zero consumers
- Fix mechanical issues on contact
- Dependencies flow one direction
- Heal before extending
- Finish gaps; don't rewrite working code
- Don't remove files you don't understand
- Pre-existing errors in touched files are YOUR problem

## Rigor

- Project constraints are binding
- Build, lint, typecheck must pass
- Warnings = failures
- Full pipeline verification required
- All hook/CI errors are your responsibility
- Fix causes, not symptoms
- No concealment (suppression, retries, no-op wrappers)
- Fix all instances of a pattern together
- Names must mean what they say
- Strict types; one concept = one name
- Comments only for non-obvious code
- Use library types; don't invent
- "Review all" = ALL instances
- Fix adjacent inconsistencies
- Verify output by reading it

## Structure

- Dependencies: one direction
- Interfaces belong to consumers
- Keep systems separate (code and prose)
- "Standalone" = remove external deps, not collapse structure
- Distinct docs for distinct systems
- One place per piece of information
- Security: validate input, allowlists, parameterized queries, escaped output
- NEVER log secrets; NEVER echo private data
- Redact credentials on contact
- Use platform validation; don't hand-roll

## Testing

- Tests verify behavior, not implementation
- Each test catches real failures
- Tests are independent, deterministic, yours to fix
- Tests live alongside code
- Optimize after measurement

## Honesty

- Conflict resolution = integrate both sides
- A feature = full path from action to result
- Original code is the spec when porting
- Read before writing; understand before changing
- User data is complete; don't invent values
- Don't infer unstated context
- "Staging"/"production" = branches unless URL specified
- "Fix all related" = evaluate each instance
- One change does one thing
- No unrequested features or removals
- Scope is sacred
- "All" = ALL, not a subset
- Show data, don't filter
- Fail fast; no fallbacks masking errors
- "Update" = modify existing artifacts
- "Didn't ship" = delete from record

## Discipline

- Named file = work site; read first
- Named inputs are the material
- "Run" = execute fresh, not read old results
- Read frameworks before configuring
- Use upstream examples; don't invent
- When tool lacks support, fix the tool
- Failures on your branch = your changes until disproven
- Working directory = project
- "Setup" = wire in, not download elsewhere
- "Resolve PR conflicts" = update source branch
- Project environment is the ONLY environment
- Use project tools; investigate unfamiliar names
- Don't block terminals; background long-running builds
- VCS mutations through VCS
- Use the tool the user names
- Named paths bind the work
- Config lives in config; code reads it
- Use existing data; don't replicate
- Missing data = crash
- Screens = leaf renderers; don't resolve upstream context
- No hardcoded external paths/conventions in screens
- Purpose-built tools beat generic ones

## Accountability

- External cause ≠ stop; find and fix the root
- "Pre-existing" ≠ move on
- Workarounds ≠ fixes
- Test failures after push = yours until proven otherwise
- User corrections = permanent facts
- User state declarations = commands
- "Already deployed/fixed" = delete related instructions
- Review = judgment, not file display
- "Check output" = observe actual output
- Broken structures = remove, not work around
- Delete duplicates causing inconsistency
- User feedback = permanent
- Plain language; cut unnecessary words
- "It's broken" = it IS broken
- Repeated request = previous attempt failed
- Rejected approach = WRONG; try fundamentally different method
- Deliverables must match request
- Blocked approaches = hard stop; switch immediately
- Documentation = specific, no filler
- Refactoring = preserve all features
- Execute, don't narrate
- Solved = test passes

## Pro-Activity

- Execute clear tasks without interruption
- Obvious next steps need no confirmation
- ACT, don't narrate
- Progress via notifications, not questions
