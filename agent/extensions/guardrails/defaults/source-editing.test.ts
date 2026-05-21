import { describe, it, expect } from "vitest";
import defaults from "./source-editing";
import { commandGroupMatches } from "../test-helpers";

describe("no-sed-on-source", () => {
  it("then blocks sed -i (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-sed-on-source",
        'sed -i \'s|from "../../documents/index.js"|from "../../documents/types.js"|g\' src/components/table-filter/*.ts',
      ),
    ).toBe(true);
    expect(
      commandGroupMatches(
        defaults,
        "no-sed-on-source",
        "sed -i 's/old/new/g' src/App.tsx",
      ),
    ).toBe(true);
  });

  it("then blocks find + sed -i (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-sed-on-source",
        "find . -name \"*.ts\" -exec sed -i 's/old/new/g' {} +",
      ),
    ).toBe(true);
  });

  it("then allows sed without -i flag", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-sed-on-source",
        "sed -n '340,390p' agent/extensions/subagents/agent-runner.ts",
      ),
    ).toBe(false);
  });
});

describe("no-curl-python-scrape", () => {
  it("then blocks curl piped to python3 -c (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-curl-python-scrape",
        'curl -s "https://en.wikipedia.org/w/api.php" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"',
      ),
    ).toBe(true);
  });

  it("then allows curl without python3 -c", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-curl-python-scrape",
        'curl -s "https://example.com" | head -10',
      ),
    ).toBe(false);
  });
});

describe("no-awk-on-source", () => {
  it("then blocks find + awk (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-awk-on-source",
        "find agent/extensions -name \"*.ts\" -exec awk 'BEGIN{c=0}' {} +",
      ),
    ).toBe(true);
  });

  it("then allows awk without find", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-awk-on-source",
        "awk -F, 'NR>1' data.csv",
      ),
    ).toBe(false);
  });
});

describe("no-heredoc-write", () => {
  it("then blocks cat > file << heredoc (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "no-heredoc-write",
        "cat > /tmp/script.py << 'PYEOF'",
      ),
    ).toBe(true);
  });

  it("then allows cat without heredoc", () => {
    expect(
      commandGroupMatches(defaults, "no-heredoc-write", "cat file.txt"),
    ).toBe(false);
  });
});

describe("nu-repl", () => {
  it("then blocks nu -c (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "nu-repl",
        "nu -c 'open \"Favorite Places.csv\" | length'",
      ),
    ).toBe(true);
  });

  it("then allows nu script execution", () => {
    expect(
      commandGroupMatches(defaults, "nu-repl", "nu /path/to/script.nu"),
    ).toBe(false);
  });
});

describe("duckdb-repl", () => {
  it("then blocks all duckdb commands (real session patterns)", () => {
    expect(
      commandGroupMatches(
        defaults,
        "duckdb-repl",
        'duckdb ~/.pi/agent/records.db "SELECT * FROM shopping LIMIT 5;"',
      ),
    ).toBe(true);
    expect(
      commandGroupMatches(
        defaults,
        "duckdb-repl",
        "duckdb :memory: -c 'SELECT 1'",
      ),
    ).toBe(true);
  });
});
