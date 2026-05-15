---
name: dfs-vs-bfs
description: "Choose between DFS and BFS for graph traversal problems. Use when deciding whether to explore depth-first (cycle detection, paths) or breadth-first (shortest path, levels)."
topic: Graph Traversal
token_cost: 100
related: [bfs-state-space, recursion-backtracking]
keywords:
  [
    dfs,
    bfs,
    depth,
    breadth,
    graph,
    traverse,
    path,
    maze,
    shortest,
    connected,
    reachable,
    visited,
    queue,
    stack,
    neighbor,
    walk,
    flood,
    fill,
    island,
  ]
---

## When to use

DFS (stack/recursion) explores one branch fully before backtracking. BFS (queue) explores level-by-level.

## Rules

- If the problem asks "shortest" or "minimum steps" on an unweighted graph, ALWAYS choose BFS
- If it asks "all paths," "can we reach," or "count islands," DFS is simpler
- NEVER use BFS for cycle detection — DFS is the right tool
- Both visit each node once: O(V+E) time

## DFS use cases

Cycle detection, topological sort, path existence, connected components, backtracking puzzles, flood fill.

## BFS use cases

Shortest unweighted path, level-order traversal, nearest neighbor, minimum steps.

## Example

"Count islands" → DFS flood-fill on 2D grid. "Shortest path in maze" → BFS with queue tracking (row, col, distance).
