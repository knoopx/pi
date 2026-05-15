---
name: sorting-choice
description: "Choose the right sorting approach using Python's built-in Timsort, heapq, or custom strategies. Use when sorting arrays, finding top-k elements, or ordering by multiple keys."
topic: Sorting
token_cost: 90
related: [binary-search, two-pointers, hash-vs-tree]
keywords:
  [
    sort,
    order,
    rank,
    largest,
    smallest,
    kth,
    median,
    arrange,
    compare,
    stable,
    priority,
    heap,
    nlargest,
    nsmallest,
    key,
    reverse,
    sorted,
  ]
---

## When to use

Python's built-in sorted()/list.sort() is Timsort — O(n log n), stable, and almost always the right choice.

## Rules

- Use key= for custom ordering
- For top-k elements, use heapq.nlargest/nsmallest (O(n log k)) instead of full sort
- For finding just the kth element, consider quickselect or statistics.median
- Counting sort / radix sort help only when values are bounded integers
- When the problem says "sort by X then by Y," use a tuple key: key=lambda x: (x.a, x.b)
- For reverse on one field only, negate it or use functools.cmp_to_key
- ALWAYS prefer built-in sort — it's optimized and stable
- NEVER implement your own sort algorithm unless the problem requires it

## Complexity

Timsort: O(n log n). heapq.nlargest/nsmallest: O(n log k).

## Example

"Top 3 scores" → `heapq.nlargest(3, scores)` in O(n log 3). "Sort by name then age" → `sorted(items, key=lambda x: (x.name, x.age))`.
