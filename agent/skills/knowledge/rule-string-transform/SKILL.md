---
name: rule-string-transform
description: "Apply ordered rules for string transformations like pig latin, atbash, or rot. Use when translating words with specific prefix/suffix rules and ordered predicate matching."
topic: Ordered-Rule String Transformation
token_cost: 120
related: [recursion-backtracking]
keywords:
  [
    pig latin,
    string rule,
    transform word,
    vowel,
    consonant,
    cluster,
    qu,
    ordered rules,
    first match,
    prefix,
    suffix,
    translate word,
  ]
---

## When to use

For rule-based string transforms (pig latin, atbash, rot, etc.).

## Rules

- Encode the rules as an ordered list of (predicate, transform) pairs
- For each word, walk the list; apply the FIRST matching rule and stop
- Order matters — specific rules MUST come before general ones
- ALWAYS test each rule in isolation before combining
- NEVER apply multiple rules to the same word

## Pig latin specifics

1. "qu" or consonant-cluster-ending-in-qu counts as a unit — "quick" → "ickquay", "square" → "aresquay"
2. "y" acts as a consonant at the start but a vowel in the middle — "yellow" → "ellowyay", "rhythm" → "ythmrhay"
3. Rule order: starts-with-vowel-or-xr-or-yt → append "ay"; starts-with-consonant(s)-then-"qu" → move cluster+qu, append "ay"; starts-with-consonants-up-to-first-"y"-or-vowel → move the consonants, append "ay"; fallback → append "ay"

## Example

Pig latin: "quick" starts with "qu" consonant cluster → "ickquay". "apple" starts with vowel → "appleay". "yellow" starts with consonant "y" → "ellowyay".
