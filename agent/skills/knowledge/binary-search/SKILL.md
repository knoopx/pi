---
name: binary-search
description: "Search on monotonic predicates for sorted arrays, answer spaces, and rotated arrays. Use when finding minimum/maximum values, insertion points, or solving 'minimize the maximum' problems."
topic: Binary Search
token_cost: 90
related: [sorting-choice, two-pointers, hash-vs-tree]
keywords:
  [
    binary,
    search,
    sorted,
    monotonic,
    bisect,
    minimum,
    maximum,
    feasible,
    predicate,
    lower,
    upper,
    bound,
    log,
    efficient,
    mid,
    pivot,
    rotated,
  ]
---

## When to use

Binary search works on any monotonic predicate, not just sorted arrays. Pattern: "find minimum X such that condition(X) is true" — binary search on the answer space.

## Rules

- Use bisect.bisect_left/bisect_right for sorted-array insertion points
- For "minimize the maximum" or "maximize the minimum" problems, binary search on the answer and check feasibility
- ALWAYS use lo + (hi - lo) // 2 to avoid overflow
- When searching rotated arrays, check which half is sorted first
- NEVER binary search on unsorted data without a monotonic predicate

## Complexity

Time: O(log n) — whenever you see "sorted" or "monotonic" in a problem, consider binary search.

## Example

"Minimize maximum load" → binary search on answer space. Check if `feasible(mid)` divides into k groups each ≤ mid. Use `lo + (hi - lo) // 2` to avoid overflow.
