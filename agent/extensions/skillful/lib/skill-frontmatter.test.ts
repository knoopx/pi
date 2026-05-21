import { describe, it, expect } from "vitest";
import { parseSkillFile } from "./skill-frontmatter";

describe("parseSkillFile", () => {
  it("parses valid frontmatter with string and array fields", () => {
    const text = `---
name: vitest
description: "Fast unit testing"
keywords: ["test", "vitest"]
related: [typescript]
---

# Vitest

Some body content here.
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("vitest");
    expect(result!.frontmatter.description).toBe("Fast unit testing");
    expect(result!.frontmatter.keywords).toEqual(["test", "vitest"]);
    expect(result!.body).toContain("# Vitest");
  });

  it("parses frontmatter with numeric fields", () => {
    const text = `---
name: test-skill
token_cost: 200
---

Body text.
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.token_cost).toBe(200);
  });

  it("parses frontmatter with boolean fields", () => {
    const text = `---
name: test-skill
enabled: true
---

Body.
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.enabled).toBe(true);
  });

  it("returns null for text without frontmatter delimiters", () => {
    expect(parseSkillFile("Just plain text without frontmatter")).toBeNull();
  });

  it("returns null for text with only one delimiter", () => {
    expect(parseSkillFile("---\nname: test")).toBeNull();
  });

  it("returns null when frontmatter is not a valid object", () => {
    const text = `---
- just a list
---

Body.
`;
    expect(parseSkillFile(text)).toBeNull();
  });

  it("returns null when frontmatter is empty", () => {
    const text = `---

---

Body.
`;
    expect(parseSkillFile(text)).toBeNull();
  });

  it("preserves body with frontmatter delimiters inside", () => {
    const text = `---
name: test-skill
---

Some code:

\`\`\`yaml
---
nested: value
---
\`\`\`
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.body).toContain("nested: value");
  });

  it("handles empty body after frontmatter", () => {
    const text = `---
name: test-skill
---
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.body).toBe("");
  });

  it("handles frontmatter with requires_tools array", () => {
    const text = `---
name: test-skill
requires_tools: [bash, jq]
---

Body.
`;
    const result = parseSkillFile(text);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.requires_tools).toEqual(["bash", "jq"]);
  });
});
