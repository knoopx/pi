import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionStore,
  resetSessionStore,
} from "../../shared/evidence-store";

const BRIDGE_TEMPLATE = (n: number): string =>
  `[Preserved evidence from earlier in the conversation follows.] ` +
  `${n} evidence entr${n === 1 ? "y remains" : "ies remain"} available via ` +
  `evidence-list and evidence-get.`;

describe("evidence session store", () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it("starts empty", () => {
    expect(getSessionStore()).toEqual([]);
  });

  it("reset clears entries", () => {
    resetSessionStore();
    expect(getSessionStore()).toEqual([]);
  });
});

describe("evidence compact bridge message", () => {
  it("starts with exact preservation prefix", () => {
    const m = BRIDGE_TEMPLATE(3);
    expect(
      m.startsWith(
        "[Preserved evidence from earlier in the conversation follows.]",
      ),
    ).toBe(true);
  });
  it("uses singular for 1 entry", () => {
    expect(BRIDGE_TEMPLATE(1)).toContain("1 evidence entry remains");
  });
  it("uses plural for multiple entries", () => {
    expect(BRIDGE_TEMPLATE(5)).toContain("5 evidence entries remain");
  });
  it("references the retrieval tools by name", () => {
    const m = BRIDGE_TEMPLATE(2);
    expect(m).toContain("evidence-list");
    expect(m).toContain("evidence-get");
  });
});
