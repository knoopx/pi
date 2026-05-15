---
name: tree-rerooting
description: "Re-root an undirected tree from any node using DFS/BFS. Use when changing the point of view in a tree, finding paths between nodes, or reparenting tree structures."
topic: Tree Re-Rooting (POV)
token_cost: 120
related: [tree-zipper, dfs-vs-bfs]
keywords:
  [
    re-root,
    reroot,
    pov,
    point of view,
    tree rotation,
    change root,
    from_pov,
    reparent,
    path between nodes,
    undirected tree,
  ]
---

## When to use

Re-rooting an undirected tree from a new node.

## Rules

- Build an undirected adjacency map (parent↔children become symmetric neighbor sets)
- Do DFS/BFS from the target node
- Every node you visit gets its parent set to the node you came from
- Its children become all neighbors minus that parent
- Path-between(a, b): re-root at a, then walk from b up parent pointers until you hit a
- If the target node is not in the tree, return None (not an error)
- NEVER mutate the original tree when re-rooting — build a fresh node structure
- ALWAYS keep the original tree intact so repeated from_pov calls work correctly

## Complexity

O(N) per re-root.

## Example

Path between a and b: build adjacency map, DFS from `a` as root, then walk from `b` up parent pointers to `a`. Always build a fresh structure — never mutate the original tree.
