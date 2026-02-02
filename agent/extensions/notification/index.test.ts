import { describe, expect, it } from "vitest";
import { buildNotifySendArgs } from "./notify-send";

describe("notification/notify-send", () => {
  describe("buildNotifySendArgs", () => {
    it("given summary and body then it should build args", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        body: "This is a test",
      });

      expect(args).toEqual(["Test Notification", "This is a test"]);
    });

    it("given only summary then it should build args", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
      });

      expect(args).toEqual(["Test Notification"]);
    });

    it("given urgency then it should add -u", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        urgency: "critical",
      });

      expect(args).toEqual(["-u", "critical", "Test Notification"]);
    });

    it("given expireTime then it should add -t", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        expireTime: 5000,
      });

      expect(args).toEqual(["-t", "5000", "Test Notification"]);
    });

    it("given appName then it should add -a", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        appName: "My Application",
      });

      expect(args).toEqual(["-a", "My Application", "Test Notification"]);
    });

    it("given icon then it should add -i", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        icon: "🔔",
      });

      expect(args).toEqual(["-i", "🔔", "Test Notification"]);
    });

    it("given category then it should add -c", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        category: "email.important",
      });

      expect(args).toEqual(["-c", "email.important", "Test Notification"]);
    });

    it("given multiple parameters then it should build args in correct order", () => {
      const args = buildNotifySendArgs({
        summary: "Test Notification",
        body: "Test body",
        urgency: "critical",
        expireTime: 3000,
        appName: "TestApp",
        icon: "warning",
        category: "alert",
      });

      expect(args).toEqual([
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
        "Test Notification",
        "Test body",
      ]);
    });
  });
});
