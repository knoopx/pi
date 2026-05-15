---
name: tree-zipper
description: "Navigate immutable trees with a zipper cursor. Use when implementing tree traversal, editing tree structures functionally, or tracking focus through breadcrumbs."
topic: Functional Tree Navigation
token_cost: 130
related: [tree-rerooting, dfs-vs-bfs]
keywords:
  [
    zipper,
    tree navigation,
    breadcrumb,
    focus,
    up,
    down,
    left,
    right,
    functional tree,
    immutable tree,
    cursor,
  ]
---

## When to use

A tree zipper is a cursor for immutable trees. State = (focus, trail).

## Rules

- focus is the current subtree
- trail is a list of "breadcrumbs" describing the path from root to focus
- Each crumb remembers the parent's value plus the siblings NOT taken
- down_left/down_right push a crumb and make the chosen child the new focus
- up pops the top crumb, rebuilds the parent, and makes that parent the new focus
- set_value replaces the focused subtree's value
- to_tree walks all the way up to rebuild the whole tree
- Key invariant: you can ALWAYS reconstruct the full original tree from (focus, trail)
- Equality of two zippers = equality of the fully-reconstructed trees, NOT of the raw (focus, trail) pairs
- NEVER compare raw (focus, trail) pairs for equality

## Operations

down_left, down_right, up, set_value, to_tree.

## Example

Navigate: `z.down_left()` pushes a crumb (parent value + right siblings), sets focus to left child. `z.up()` pops crumb, rebuilds parent. `z.to_tree()` walks all the way up. Compare zippers by `to_tree()` equality, never raw (focus, trail).
