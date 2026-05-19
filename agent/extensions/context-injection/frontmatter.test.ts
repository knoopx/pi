import { describe, it, expect } from "vitest";
import { parseSkillFile } from "../../shared/skill-frontmatter";

describe("parseSkillFile", () => {
	it("parses basic tool-guidance frontmatter", () => {
		const text = `---
name: read
type: tool-guidance
token_cost: 100
---
## Read Tool
Body content here.`;
		const p = parseSkillFile(text);
		expect(p).not.toBeNull();
		expect(p!.frontmatter.name).toBe("read");
		expect(p!.frontmatter.token_cost).toBe(100);
		expect(p!.body.startsWith("## Read Tool")).toBe(true);
	});

	it("parses knowledge frontmatter with keyword arrays", () => {
		const text = `---
name: bfs-state-space
topic: State-Space Search
token_cost: 120
keywords: [bucket, pouring, state space, minimum moves, shortest sequence]
---
When a problem asks for minimum moves.`;
		const p = parseSkillFile(text);
		expect(p).not.toBeNull();
		expect(p!.frontmatter.topic).toBe("State-Space Search");
		expect(p!.frontmatter.keywords).toEqual([
			"bucket",
			"pouring",
			"state space",
			"minimum moves",
			"shortest sequence",
		]);
	});

	it("parses tool skill with keywords", () => {
		const text = `---
name: vitest
description: "Runs tests."
token_cost: 180
keywords: [vitest, test, mock, coverage]
---
Body.`;
		const p = parseSkillFile(text);
		expect(p).not.toBeNull();
		expect(p!.frontmatter.name).toBe("vitest");
		expect(p!.frontmatter.keywords).toEqual([
			"vitest",
			"test",
			"mock",
			"coverage",
		]);
	});

	it("parses requires_tools arrays", () => {
		const text = `---
name: workspace-docs
topic: Workspace Documentation
keywords: [spec, readme]
requires_tools: [Read, Glob]
---
body`;
		const p = parseSkillFile(text);
		expect(p!.frontmatter.requires_tools).toEqual(["Read", "Glob"]);
	});

	it("returns null on missing frontmatter", () => {
		expect(parseSkillFile("no frontmatter here")).toBeNull();
	});

	it("handles body with multiple --- separators", () => {
		const text = `---
name: x
topic: X
---
body line 1
---
body line 2`;
		const p = parseSkillFile(text);
		expect(p).not.toBeNull();
		expect(p!.body).toContain("body line 1");
		expect(p!.body).toContain("body line 2");
	});
});
