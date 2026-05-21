import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "no-sed-on-source",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "sed -i *",
        action: "block",
        reason:
          "do not use sed to modify source files. Use the edit tool for targeted changes, or AST-aware tools (retype, sg) for structural refactoring (read skill: typescript-editing)",
      },
      {
        context: "command",
        pattern: "find * -exec sed -i * {} *",
        action: "block",
        reason:
          "do not use find + sed to modify source files. Use AST-aware tools (retype, sg) for bulk refactoring (read skill: typescript-editing)",
      },
    ],
  },
  {
    group: "no-curl-python-scrape",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "curl * | python3 -c *",
        action: "block",
        reason:
          "do not use curl piped to inline Python for web scraping. Use the `web-fetch` tool instead (read skill: prefer-agent-tools)",
      },
    ],
  },
  {
    group: "no-awk-on-source",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "find * -exec awk * {} *",
        action: "block",
        reason:
          "do not use find + awk to analyze source files. Use AST-aware tools (fallow, jscpd, knip) for code analysis (read skill: project-exploration)",
      },
    ],
  },
  {
    group: "no-heredoc-write",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "cat * < *",
        action: "block",
        reason:
          "do not use heredoc (cat > file <<) to write files. Use the write tool instead (read skill: prefer-agent-tools)",
      },
    ],
  },
  {
    group: "nu-repl",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "nu -c *",
        action: "block",
        reason:
          "do not use bash + nu -c for inline nushell. Use the `nu-repl` tool instead (read skill: prefer-agent-tools)",
      },
    ],
  },
  {
    group: "duckdb-repl",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "duckdb *",
        action: "block",
        reason:
          "do not use bash + duckdb for SQL. Use the `duckdb-repl` tool instead (read skill: prefer-agent-tools)",
      },
    ],
  },
];

export default defaults;
