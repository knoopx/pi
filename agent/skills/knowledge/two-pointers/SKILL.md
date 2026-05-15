---
name: two-pointers
description: "Solve pair-sum, sliding window, and cycle detection problems with two pointers. Use when reducing O(n²) nested loops to O(n) on sorted or sequential data."
topic: Two Pointers and Sliding Window
token_cost: 100
related: [binary-search, sorting-choice, hash-vs-tree]
keywords:
  [
    pointer,
    two,
    sliding,
    window,
    substring,
    subarray,
    pair,
    sum,
    target,
    sorted,
    left,
    right,
    fast,
    slow,
    cycle,
    linked,
    list,
    contiguous,
    consecutive,
    squeeze,
  ]
---

## When to use

Two pointers on a sorted array: start left=0, right=n-1, move inward based on comparison.

## Rules

- Solves pair-sum, three-sum, container problems in O(n)
- Sliding window: expand right boundary, shrink left when constraint violated
- Solves "longest/shortest substring with property" in O(n)
- Fast/slow pointers: detect cycles in linked lists (Floyd's), find middle element
- If brute force is O(n^2) nested loops over a sorted or sequential structure, two pointers likely reduces it to O(n)
- ALWAYS prefer two pointers over nested loops when data is sorted
- NEVER use nested loops when two pointers would work

## Complexity

Two pointers: O(n). Sliding window: O(n). Fast/slow: O(n).

## Example

"Two sum on sorted" → `left=0, right=n-1`; if `arr[left]+arr[right] < target`: left++, else right--. "Longest substring without repeats" → expand right, shrink left when duplicate found.
