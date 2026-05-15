---
name: dynamic-programming
description: "Solve problems with overlapping subproblems and optimal substructure using memoization or tabulation. Use when finding minimum cost, counting ways, or computing longest/shortest subsequences."
topic: Dynamic Programming
token_cost: 110
related: [bfs-state-space, recursion-backtracking]
keywords:
  [
    dynamic programming,
    dp,
    memoize,
    memoization,
    tabulation,
    subproblem,
    overlapping,
    optimal substructure,
    fibonacci,
    knapsack,
    longest,
    subsequence,
    minimum cost,
    maximum profit,
    number of ways,
    climb,
    stairs,
    coins,
    edit distance,
  ]
---

## When to use

Use dynamic programming when a problem has overlapping subproblems (same computation repeated) and optimal substructure (optimal solution built from optimal sub-solutions).

## Signs

"find minimum cost," "count the number of ways," "longest/shortest subsequence," "can you reach."

## Rules

- Define state (what changes between subproblems) and recurrence (how states relate)
- Top-down with @cache is easiest to write; bottom-up tabulation avoids recursion limits and is often faster
- ALWAYS check if you can reduce space by keeping only the previous row/state instead of the full table
- NEVER memoize without verifying overlapping subproblems exist

## Approach

1. Identify the state variables
2. Write the recurrence relation
3. Choose top-down (@cache) or bottom-up (tabulation)
4. Optimize space if possible

## Example

"Min coins for amount" → state = remaining amount. Recurrence: `dp(n) = 1 + min(dp(n - c) for c in coins)`. Use @cache for top-down; reduce to O(amount) space.
