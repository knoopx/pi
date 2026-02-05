---
name: nomnoml
description: Writes, edits, and renders nomnoml diagrams (text-to-UML) for architecture sketches, class diagrams, sequence-like flows, and relationship graphs. Use when asked to create or update nomnoml code, convert a description into a diagram, or render nomnoml to SVG/PNG for docs.
---

# nomnoml

Convert plain-text descriptions into nomnoml markup and (optionally) render it via CLI.

Primary reference: https://nomnoml.com

## Quick start

### Minimal diagram

```nomnoml
[User]->[AuthService]
[AuthService]->[DB]
```

### Typical class box

```nomnoml
[Order|
  +id: UUID;
  +total: Money;
  |
  +addItem(item);
  +checkout();
]
```

## Syntax essentials

### Nodes (boxes)

- Basic: `[A]`
- With compartments (title | attributes | methods): `[A|x; y|do();]`
- Escape newlines with actual newlines (preferred) or `\n` when needed.

### Relationships (common)

```text
[A]->[B]        # association / dependency
[A]-->[B]       # dotted
[A]-:>[B]       # composition-like (varies by style)
[A]<-[B]        # reverse arrow
[A]-[B]         # line without arrow
```

If arrow semantics are ambiguous, prefer clear labels:

```nomnoml
[API]->[DB]
[API] "reads/writes" -> [DB]
```

### Cardinalities / labels

```nomnoml
[Customer] 1->* [Order]
[Order] 1->* [OrderLine]
```

### Grouping

```nomnoml
[<frame> Payments|
  [API]
  [Worker]
]

[API]->[Worker]
```

Common containers:

- `<frame>`: big box grouping
- `<package>`: package-like grouping
- `<actor>`: actor stick figure

### Styling / directives

Add directives at the top using `#`:

```nomnoml
#direction: right
#spacing: 40
#ranker: tight-tree

[Client]->[API]
```

Common directives:

- `#direction: right|down`
- `#spacing: <number>`
- `#padding: <number>`
- `#ranker: network-simplex|tight-tree|longest-path`

## Workflow: generate a diagram from a description

1. Identify the **diagram type**:
   - Class/data model → boxes with compartments + inheritance/associations
   - Architecture/services → frames/packages + arrows + labeled edges
   - Flow/steps → simple boxes + arrows; keep it readable

2. Choose names:
   - Use stable nouns for nodes (`AuthService`, `TokenStore`, `Frontend`).
   - Keep node names short; put details in compartments or labels.

3. Produce nomnoml code:
   - Start with `#direction: right` for architecture diagrams.
   - Use frames/packages to group by bounded context.
   - Add labels for anything non-obvious.

4. Iterate:
   - If diagram is too dense, split into multiple diagrams (by subsystem).

## Rendering (CLI)

If a rendered asset is needed, use one of these approaches.

### Option A: use the online renderer

- Open https://nomnoml.com
- Paste the nomnoml text
- Export SVG/PNG

### Option B: use the npm CLI (when Node tooling is available)

Typical install/use (varies by environment):

```bash
# one-off run
npx nomnoml-cli -i diagram.nomnoml -o diagram.svg

# or install
npm i -g nomnoml-cli
nomnoml diagram.nomnoml --output diagram.svg
```

If the CLI isn’t available, still produce the `.nomnoml` source file so it can be rendered later.

## Patterns

### Architecture sketch (recommended default)

```nomnoml
#direction: right

[<actor> User]->[WebApp]

[<frame> Backend|
  [API]
  [Worker]
]

[WebApp]->[API]
[Worker]->[DB]
[API]->[DB]

[DB]
```

### Class diagram with inheritance

```nomnoml
[<abstract> Animal|+name: string|+speak()]
[Dog|+breed: string|+speak()]
[Cat|+color: string|+speak()]

[Animal]<:-[Dog]
[Animal]<:-[Cat]
```

### Entity relationship (simple)

```nomnoml
#direction: down

[User|id; email]
[Session|id; userId; expiresAt]

[User] 1->* [Session]
```

## When asked to “update an existing diagram”

- Preserve existing node names unless there’s a clear rename.
- Apply the smallest diff:
  - add one box/edge at a time
  - keep direction/ranker consistent
- If you change meaning, update edge labels to stay explicit.
