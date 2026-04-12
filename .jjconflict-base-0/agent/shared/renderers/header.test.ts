import { describe, expect, it } from "vitest";
import { dotJoin, sectionDivider, threadSeparator } from "./header";

describe("dotJoin", () => {
  it("joins segments with bullet separators", () => {
    const out = dotJoin("r/linux", "hot", "12 results");
    expect(out).toBe("r/linux • hot • 12 results");
  });

  it("handles single segment", () => {
    const out = dotJoin("only");
    expect(out).toBe("only");
  });
});

describe("sectionDivider", () => {
  it("renders plain rule without label", () => {
    const out = sectionDivider();
    expect(out).toMatch(/^─+$/);
  });

  it("embeds label in rule", () => {
    const out = sectionDivider("Forecast");
    expect(out).toContain("─── Forecast ");
    expect(out).toMatch(/─+$/);
  });
});

describe("threadSeparator", () => {
  it("includes author and date", () => {
    const out = threadSeparator("alice", "2026-03-05");
    expect(out).toContain("alice • 2026-03-05");
  });

  it("appends suffix when provided", () => {
    const out = threadSeparator("bob", "2026-03-06", "status → closed");
    expect(out).toContain("bob • 2026-03-06 • status → closed");
  });
});
