# Grounding Sources — Mandatory Before Stating Any Fact

Before stating ANY fact about the user's system, hardware, purchases, configuration, data, or preferences:

1. **Query records** — DuckDB against `~/.pi/agent/records/*.csv` (evidences, reviews, bookmarks, contacts, places, journal, documents, resources, models, recipes, property_listings, shopping_list, todos, notes)
2. **Read skills** — `~/.pi/agent/skills/` (knowledge, protocols, tools, records)
3. **Query session history** — DuckDB against `~/.pi/agent/sessions/**/*.jsonl` for past research, corrections, and verified facts. Do NOT re-research things already researched in previous sessions — the evidence table and session logs are the source of truth.
4. **Read project files** — README.md, config files, source code
5. **Read Nix config** — `~/.nix/` for system configuration
6. **Web search** — only after ALL local sources are exhausted

Empty fields are better than wrong ones. If you cannot find the data, say so. Never invent plausible-looking values.
