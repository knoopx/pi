---
name: recursion-backtracking
description: "Generate all valid arrangements using backtracking with pruning. Use when solving permutations, combinations, subsets, N-queens, sudoku, or constraint satisfaction problems."
topic: Backtracking
token_cost: 100
related: [dynamic-programming, dfs-vs-bfs]
keywords:
  [
    permutation,
    combination,
    subset,
    backtrack,
    constraint,
    generate,
    valid,
    recursive,
    pruning,
    n-queens,
    sudoku,
    exhaustive,
    all,
    solutions,
    choose,
    pick,
    arrangement,
    password,
    sequence,
  ]
---

## When to use

Use backtracking for constraint satisfaction and combinatorial generation: permutations, combinations, subsets, N-queens, sudoku, valid arrangements.

## Rules

- Pattern: make a choice, recurse, undo the choice (backtrack)
- Prune early — skip branches that already violate constraints to avoid exploring dead ends
- For subsets: at each element, choose to include or exclude it (2^n total)
- For permutations: choose each unused element at each position (n! total)
- ALWAYS pass state by reference and undo mutations rather than copying
- NEVER copy state — it's wasteful and slow
- If the problem says "generate all" or "find all valid," backtracking is usually the right approach

## Complexity

Subsets: 2^n. Permutations: n!.

## Example

Subsets of [1,2,3]: at each element, branch include/exclude. `def solve(i): if i==n: yield list(path); return; path.append(nums[i]); solve(i+1); path.pop(); solve(i+1)`.
