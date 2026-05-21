import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockFsPromises,
  createNotifyFixture,
  sendNotification,
} from "./test-factories";

const mockFs = createMockFsPromises();

vi.mock("node:fs/promises", () => mockFs);

describe("buildErrorResult path", () => {
  const fixture = createNotifyFixture();

  beforeEach(async () => {
    await fixture.setup();
  });

  it("returns error with default message when stderr is empty", async () => {
    fixture.mockPi.exec.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "",
    });
    const result = (await sendNotification(fixture.tool, false)) as {
      content: Array<{ text: string }>;
    };
    expect(result.content[0].text).toContain("notify-send failed");
  });

  it("includes stdout in details when stderr is empty", async () => {
    fixture.mockPi.exec.mockResolvedValue({
      code: 1,
      stdout: "some output",
      stderr: "",
    });
    const result = (await sendNotification(fixture.tool, false)) as {
      details: { output: string };
    };
    expect(result.details.output).toBe("some output");
  });
});
