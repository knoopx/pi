---
name: bfs-state-space
description: "Model minimum-move problems as BFS over a state space. Use when solving bucket pouring puzzles, sliding tiles, or any problem asking for the shortest sequence of moves to reach a goal."
topic: State-Space Search
token_cost: 120
related: [dfs-vs-bfs, dynamic-programming]
keywords:
  [
    bucket,
    pouring,
    state space,
    minimum moves,
    shortest sequence,
    reach goal,
    transitions,
    visited states,
    water,
    pour,
    fill,
    empty,
  ]
---

## When to use

When a problem asks for the MINIMUM number of moves/steps to reach a goal state (bucket pouring, puzzle solving, sliding tiles), model it as BFS over a state space.

## Rules

- State = a tuple of all values that fully describe the situation (e.g. (bucket_a, bucket_b))
- From each state, enumerate every legal transition and produce the next state
- Use a visited set keyed on the state tuple to avoid cycles
- BFS from the start state; the first time you pop a state matching the goal, its distance is the minimum move count
- Track which bucket holds the goal and the other bucket's value at that point
- NEVER skip the visited check — cycles will cause infinite loops
- ALWAYS encode forbidden moves as filters on transitions, not as special cases

## Example

Transitions for bucket pouring: fill A, fill B, empty A, empty B, pour A→B, pour B→A.

## Edge cases

If start_bucket is forbidden as an immediate "fill the wrong one first" move, encode that as a filter on the initial transitions.

## Example

Bucket pouring: state = (a, b). Transitions: fill A, fill B, empty A, empty B, pour A→B, pour B→A. BFS from (0, 0); first time a state has a goal value, that distance is the minimum.
