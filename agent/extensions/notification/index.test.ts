 
import { describe, expect, it } from "vitest";
import { buildNotifySendArgs } from "./notify-send";

const SUMMARY = "Test Notification";

function assertArgs(
  params: Parameters<typeof buildNotifySendArgs>[0],
  expected: string[],
) {
  const args = buildNotifySendArgs(params);
  expect(args).toEqual(expected);
}

describe("notification/notify-send", () => {
  describe("buildNotifySendArgs", () => {
    it("given summary and body then it should build args", () => {
      assertArgs({ summary: SUMMARY, body: "This is a test" }, [
        SUMMARY,
        "This is a test",
      ]);
    });

    it("given only summary then it should build args", () => {
      assertArgs({ summary: SUMMARY }, [SUMMARY]);
    });

    it("given urgency then it should add -u", () => {
      assertArgs({ summary: SUMMARY, urgency: "critical" }, [
        "-u",
        "critical",
        SUMMARY,
      ]);
    });

    it("given expireTime then it should add -t", () => {
      assertArgs({ summary: SUMMARY, expireTime: 5000 }, [
        "-t",
        "5000",
        SUMMARY,
      ]);
    });

    it("given appName then it should add -a", () => {
      assertArgs({ summary: SUMMARY, appName: "My Application" }, [
        "-a",
        "My Application",
        SUMMARY,
      ]);
    });

    it("given icon then it should add -i", () => {
      assertArgs({ summary: SUMMARY, icon: "🔔" }, ["-i", "🔔", SUMMARY]);
    });

    it("given category then it should add -c", () => {
      assertArgs({ summary: SUMMARY, category: "email.important" }, [
        "-c",
        "email.important",
        SUMMARY,
      ]);
    });

    it("given multiple parameters then it should build args in correct order", () => {
      assertArgs(
        {
          summary: SUMMARY,
          body: "Test body",
          urgency: "critical",
          expireTime: 3000,
          appName: "TestApp",
          icon: "warning",
          category: "alert",
        },
        [
          "-u",
          "critical",
          "-t",
          "3000",
          "-a",
          "TestApp",
          "-i",
          "warning",
          "-c",
          "alert",
          SUMMARY,
          "Test body",
        ],
      );
    });
  });
});
