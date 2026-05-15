---
name: hash-vs-tree
description: "Choose between hash tables and tree structures for lookups, counting, and grouping. Use when deciding between O(1) hash operations and O(log n) ordered operations."
topic: Data Structure Choice
token_cost: 90
related: [sorting-choice, two-pointers, binary-search]
keywords:
  [
    lookup,
    dictionary,
    dict,
    set,
    hash,
    hashtable,
    map,
    frequency,
    count,
    unique,
    duplicate,
    ordered,
    sorted,
    tree,
    counter,
    defaultdict,
    collections,
  ]
---

## When to use

Use dict/set (hash table, O(1) avg lookup) for: membership testing, frequency counting, deduplication, grouping by key.

## Rules

- Use collections.Counter for frequency counts, defaultdict(list) for grouping
- When you need ordered keys or range queries, use sorted containers or bisect on a sorted list
- For "find if X exists" or "count occurrences," ALWAYS reach for a set or dict first
- NEVER scan a list repeatedly when a set/dict would work
- If the problem involves pairs summing to a target, use a set to check complements in O(n) instead of O(n^2) nested loops

## Complexity

Hash table: O(1) avg lookup. Sorted containers: O(log n) lookup.

## Example

"Two sum" → store complements in a set: `for x in nums: if target - x in seen: return True; seen.add(x)`. O(n) vs O(n²) nested loops.
