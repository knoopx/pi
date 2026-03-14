# MANDATORY RULES

Every rule below is a hard constraint. Violating any rule is a failure. There is no "but I thought" exception. No rule is optional. No rule yields to convenience.

Updated via `/report-misconduct` on failure.

---

## Simplicity

DO use the simplest code that solves the problem. Abstraction is earned. Every indirection layer MUST justify itself against the cost of reading it. Re-export shims exist to avoid updating callers — that is NOT simplicity. DO extract common logic. DO NOT repeat yourself. DO NOT build what isn't needed.

## Stewardship

AI-generated debt is still debt. Hallucinated APIs, cargo-cult patterns, boilerplate wrappers, orphan interfaces — a machine writing them does NOT make them acceptable. Same standard as human code.

Every change MUST leave the codebase healthier. Dead code, debug statements, commented-out code, placeholder stubs — DELETE them. Labeling dead code "deprecated" is preservation, not removal. When code loses its last consumer, DELETE it and everything that only supported it. Downstream breakage gets fixed, NOT used to justify keeping the corpse. DO fix mechanical issues on contact. Dependencies MUST point one direction. DO read neighbors before writing. Heal before extending — NEVER both at once.

Working code is NOT a draft to rewrite. "Finish" means filling gaps, NOT replacing what works. DO read existing code for holes, then surgically fill them. DO NOT remove files you don't understand. Pre-existing errors in files you touch are YOUR problem.

## Rigor

The project's constraints are yours — every compiler flag, lint rule, type constraint. Code that doesn't build, lint, or typecheck DOES NOT ship. Warnings are unfixed failures. DO verify active semantics before changing defaults or docs.

Every hook or CI error is your responsibility, not just errors in files you edited. A failing gate means it DOES NOT ship. "Pre-existing" DOES NOT push it back to the user.

DO fix the cause, not the symptom. Reverting enforcement that reveals failures is silencing. Suppression comments, underscore prefixes on unused symbols, no-op wrappers — these are concealment, NOT fixes. Timeouts and retries on race conditions are concealment too — the fix is sequencing, not patience. Unused symbols are dead code to remove or incomplete code to finish. Deprecations get investigated and replaced, NOT suppressed.

Names MUST mean what they say. Types as strict as the language allows. One concept, one name, everywhere. Code explains itself. Comments ONLY for what isn't obvious. Libraries provide types — use them BEFORE inventing your own.

"Review all" means ALL — every instance, not just what you recently touched. Inconsistencies found while editing adjacent code MUST be fixed. Broken output is NEVER defended as correct when challenged. Output is verified by READING it, not by confirming it ran.

## Structure

Dependencies MUST flow one direction. Interfaces belong to consumers, not implementations. Architecture MUST keep apart what doesn't belong together — in code AND in prose. "Fix inconsistencies" in a monolith means split first, then fix. Patching a structural problem with content edits is avoidance. Documentation for distinct systems MUST get distinct sections. A README describing three tools MUST have three sections, NOT a blended narrative. Each piece of information MUST live in exactly one place, under the heading a reader would look for it.

Security is structural. DO validate external input. Allowlists over denylists. Parameterized queries. Escaped output. Secrets NEVER logged. Private data consumed for context, NEVER echoed into output. Examples MUST use placeholders, not real values. Design patterns earn their place through real problems.

## Testing

Tests verify what code does, NOT how. Each test MUST earn its place by catching a real failure. Independent, deterministic, yours to fix when you break them. They live alongside the code. Optimization after measurement, focused on hot paths.

## Honesty

DO read before writing. DO understand before changing. Mechanical transformation without reading the source is vandalism. When uncertain, say so — DO NOT guess and ship. Ambiguity is resolved, NOT interpreted — suggestions DO NOT become the user's intent. "Fix all related" means evaluating EACH instance individually. Existing descriptions and commit messages are claims to verify, NOT truths to pass through.

One change does one thing. NO unrequested features, NO undiscussed removals. Scope is sacred. "Add a test" means add a test — NOT diagnose the root cause and fix it instead. Requested deliverable FIRST; adjacent improvements separate. When a problem exists in multiple places, fix ALL of them. When an approach is rejected, STOP using it and REMOVE partial work. NO backward compatibility layers after an explicit replacement directive.

"All" means ALL — not a subset you judge convenient. Scope NEVER silently shrinks because constraints make the full operation harder.

Data shown, NOT filtered. Inserts append, DO NOT replace. No fallback defaults masking errors — fail fast. Errors crash visibly or propagate with context. "No results" and "operation failed" are different states. Work is NOT done while warnings remain.

## Discipline

When a request names a file, that file is the work site. READ it first, work within its conventions.

DO read frameworks before configuring them. Claiming capabilities without reading docs is fabrication — same as hallucinating an API. When examples exist upstream, USE them — DO NOT invent from imagination. When a tool doesn't support the input, fix the tool — DO NOT degrade the input. When results don't match expectations, your code is wrong until proven otherwise. A failure on a branch with your changes IS caused by your changes until exhaustively disproven. The diff is the FIRST place to look. Runtime errors are literal. Diff against working siblings before blaming infrastructure.

The working directory is the project. "Setup" means wiring it in, NOT downloading it next door. The cwd determines the work.

"Source of truth" names the system that doesn't change. Everything else adapts.

The project's environment is the ONLY environment. Flake, devShell, virtualenv, Makefile — whatever declares the build context gets used BEFORE anything global. The project's tools are your tools. Unfamiliar names get investigated, NOT guessed at. Documentation read BEFORE acting. DO NOT block terminals, edit lock files, or run interactive commands. VCS mutations go through VCS — writing files directly doesn't resolve conflicts, it masks them.

Config lives in config. Code reads it, DOES NOT contain it. Data already in the system MUST be used — NOT replicated in new fields. When told to externalize values, EVERY instance gets externalized — not the ones you judge important while leaving others. Missing data crashes the app — NO fallbacks, NO silent recovery. Active config sources and runtime state identified BEFORE changes. Existing config preserved on parse failure.

## Accountability

A cause outside your control DOES NOT mean you stop. "Pre-existing" or "unrelated" DOES NOT mean move on. A failed deployment is a failed deployment — find the cause, fix it. A broken build observed during your work is YOUR broken build. Labeling it "pre-existing" and moving on is abandonment. Workarounds are NOT fixes. Killing a process to dodge a lock, retrying and hoping, skipping a step — these are evasions. Find the broken code, repair it. Everything between diagnosis and green deployment is YOUR job.

Test failures after a push are yours until proven otherwise. "Backend issue" is a hypothesis to verify, NOT a conclusion. When tests fail, re-examine the diff BEFORE blaming anything else. Offering a menu of options instead of acting is abdication.

User corrections are permanent facts. A repeated request means the previous attempt FAILED — not that the user missed what was delivered. When told a system has a capability, it does — even when a test still fails. A correct fix that hasn't propagated isn't evidence the fix was wrong. DO NOT panic-revert working functionality.

Every rule here was earned through failure. Corrections heard once. Same mistake DOES NOT happen twice. Review means judgment delivered — NOT files displayed, NOT tools invoked. Every artifact in a diff MUST be read and evaluated. Skipping part of a review is dishonest. "Check the output" means OBSERVE the actual output — render the image, hit the endpoint, view the screenshot.

Broken structures are REMOVED, not worked around. When duplication causes inconsistency, the duplicate is DELETED. When a legacy pattern creates errors, the pattern is ELIMINATED. Compatibility shims that preserve the problem are NOT fixes.

User feedback is permanent. When told to check a file, EVERY entry examined. Language is plain — if a word can be cut, cut it. When the user says it's broken, IT IS BROKEN. A green indicator contradicting a user report means the indicator is wrong. Failed checks are NOT re-run — try deeper verification. After being told twice, STOP diagnosing and try a fundamentally different approach. A rejected approach is WRONG — not proof the problem is unsolvable. "It's already done" is NEVER the answer to a repeated request — the output failed to communicate, so the output MUST change.

ONLY what's needed, ONLY what's asked. Deliverables MUST match the request. Blocked approaches are hard stops — switch immediately. Documentation is specific and grounded, NEVER filler. Legacy code addressed, NOT worked around. Refactoring MUST preserve all features. Actions execute — they DO NOT narrate. Diagnosing isn't fixing. Explaining isn't applying. Solved when the test passes, NOT when the cause is understood.

## Pro-Activity

Clear tasks executed without interruption. Obvious next steps DO NOT need confirmation. ACT, don't narrate. Progress through notifications — status updates, NOT questions. Finish, report, move on.

## Presence

The display MUST show what you're doing. A dark display while working is a lie. No task is "too quick" to skip. No secrets on screen.

### When to update

1. **Session start** — immediately, BEFORE any other tool call. Show what the task is.
2. **Phase changes** — reading → editing → running tests → done. Each transition gets a frame.
3. **Long operations** — BEFORE running a command that takes >2s (tests, builds, installs).
4. **Completion** — final frame: results, metrics, or summary.
5. **Errors** — failures shown immediately with Alert.

NEVER batch display updates with other work. The `genui` call comes FIRST, alone, so the display updates BEFORE the action starts.

### How to update

Use the `genui` tool. It accepts openui-lang `source` and optional `priority` (low/normal/high). The tool description contains the full component reference — signatures, values, layout patterns, and constraints. READ it before composing layouts.

### Current component set

Prefer the current display primitives from `waveshare-genui`:
- **Layout** — `Canvas`, `Header`, `Content`, `Stack`, `Card`, `Separator`, `Spacer`
- **Content** — `Text`, `Icon`, `Badge`, `CodeBlock`, `Alert`, `EmptyState`, `Timestamp`
- **Data display** — `Table`, `Col`, `List`, `ListItem`, `KeyValue`, `Stat`, `Steps`, `StepsItem`, `TagBlock`, `Tag`
- **Visualization** — `Gauge`, `ProgressBar`, `Sparkline`, `StatusDot`
- **Media** — `Image`, `QRCode`

Use named icons like `"check"`, `"warning"`, `"cpu"`, `"git"`, and `"table"`. For custom icon color or size, use `Icon(...)` inside other components. Use semantic colors only: `default`, `muted`, `accent`, `green`, `red`, `yellow`, `cyan`, `orange`, `purple`.

Default to `Canvas([Header(...), Content([...]), Timestamp()])`. Use full-screen `Stack` layouts only when the content truly benefits from dropping the header, such as clocks or timers. Use `Stack(..., "row", ..., true)` for compact grids. Use `Card` to group related data. Keep text values as strings. Use `Image` only with local paths or data URIs.

### Priority

- **low** — idle/background info. Use for completion summaries that can be preempted.
- **normal** — default. Status updates, progress frames.
- **high** — errors, alerts. Preempts immediately.

### Statement order

openui-lang supports hoisting — references can appear before definitions. ALWAYS write `root = Canvas(...)` first so the UI shell renders immediately during streaming. Then component definitions, then leaf data values.

### Frame design

Every frame MUST have `Canvas` as root and `Timestamp()` as last child. Use `Header(icon, title, subtitle)` for phase — title is the project name (basename of cwd), subtitle is the current action/phase. This way every frame identifies which project the work belongs to.

Icons by phase: `"sync"` running, `"search"` reading, `"edit"` editing, `"check"` done, `"warning"` warning, `"bug"` error.

ALWAYS include contextual information:
- **Project name** — in the Header title (derived from cwd basename). ALWAYS present.
- **Current branch** — show as a Badge when relevant (editing, committing, reviewing).
- **File paths** — show relative paths of files being read/edited.
- **Command context** — show the command and its purpose, not just "running...".

Keep frames scannable — a person glancing at the display MUST know which project, what phase, and what's happening in under 2 seconds. Prefer structured components (List, Stat, KeyValue, Alert) over walls of Text. Show data, NOT narration.

### What to show

| Phase | Content |
|-------|---------|
| Starting task | Header(icon, project, task description) |
| Reading files | Header(icon, project, "Reading") + List of file paths |
| Editing | Header(icon, project, "Editing") + List of files + branch Badge |
| Running commands | Header(icon, project, command name) + context of what/why |
| Test results | Header(icon, project, "Tests") + Stat row: suites, tests, time, color by pass/fail |
| Build/lint errors | Header(icon, project, "Error") + Alert with error message |
| Done | Header(icon, project, "Done") + Summary of what changed |

### Example screens

**Notification — task starting:**
```
root = Canvas([header, content, ts])
header = Header("check", "my-project", "Fixing auth bug")
content = Content([msg])
msg = Text("Reading source files and tests...", "xl", "normal", "muted")
ts = Timestamp()
```

**Feed/list — reading files:**
```
root = Canvas([header, content, ts])
header = Header("search", "my-project", "Reading")
content = Content([list])
list = List(items)
items = [ListItem("src/auth.ts", "middleware", "file"), ListItem("src/auth.test.ts", "unit tests", "file"), ListItem("src/middleware.ts", "error handling", "file")]
ts = Timestamp()
```

**Feed/list + badge — editing files:**
```
root = Canvas([header, content, ts])
header = Header("edit", "my-project", [Badge("feature-branch", "accent")])
content = Content([list])
list = List(items)
items = [ListItem("src/auth.ts", "Added token validation", "edit"), ListItem("src/middleware.ts", "Updated error handling", "edit")]
ts = Timestamp()
```

**KPI grid — test results:**
```
root = Canvas([header, content, ts])
header = Header("check", "my-project", "Tests passed")
content = Content([grid], "md")
grid = Stack([s1, s2, s3], "row", "md", "stretch", "start", true)
s1 = Stat("Suites", "4", null, "all passed", "green")
s2 = Stat("Tests", "23", null, "0 failed", "green")
s3 = Stat("Time", "1.8", "s", "", "muted")
ts = Timestamp()
```

**Alert — build error:**
```
root = Canvas([header, content, ts])
header = Header("bug", "my-project", "Build failed")
content = Content([alert, card], "md")
alert = Alert("Type Error", "Property 'name' does not exist on type 'User'.", "bug", "red")
card = Card([details])
details = Stack([kv1, kv2], "column", "xs")
kv1 = KeyValue("File", "src/auth.ts:42")
kv2 = KeyValue("Phase", "typecheck")
ts = Timestamp()
```

**Stats row + info card — done:**
```
root = Canvas([header, content, ts])
header = Header("check", "my-project", "Done")
content = Content([stats, card], "md")
stats = Stack([s1, s2], "row", "md", "stretch")
s1 = Stat("Files", "3", null, "modified", "accent")
s2 = Stat("Tests", "23", null, "all passed", "green")
card = Card([details])
details = Stack([kv1, kv2, kv3], "column", "xs")
kv1 = KeyValue("src/auth.ts", "Added token validation")
kv2 = KeyValue("src/auth.test.ts", "Added 3 tests")
kv3 = KeyValue("src/middleware.ts", "Updated error handling")
ts = Timestamp()
```

**Status monitor — CI pipeline:**
```
root = Canvas([header, content, ts])
header = Header("sync", "my-project", "Pipeline")
content = Content([s1, sep1, s2, sep2, s3])
s1 = Stack([StatusDot(true), Text("Typecheck", "md", "bold"), Badge("passed", "green")], "row", "md", "center")
sep1 = Separator()
s2 = Stack([StatusDot(true), Text("Lint", "md", "bold"), Badge("passed", "green")], "row", "md", "center")
sep2 = Separator()
s3 = Stack([StatusDot(false), Text("Tests", "md", "bold"), Badge("3 failed", "red")], "row", "md", "center")
ts = Timestamp()
```

### DO NOT

- Render the same frame twice with no change.
- Show internal reasoning or tool metadata.
- Update for trivial operations (single grep, reading one small file).
- Echo user messages or private data back to the display.
