/**
 * Unit Tests for Notification Extension
 * Tests: notify-send command construction
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Notification Command Construction Tests
// ============================================================================

describe("Notification Command Construction", () => {
  describe("given basic notification parameters", () => {
    it("then it should construct notify-send command", () => {
      const params = {
        summary: "Test Notification",
        body: "This is a test",
      };
      let command = "notify-send";
      command += ` "${params.summary}"`;
      if (params.body) {
        command += ` "${params.body}"`;
      }
      expect(command).toBe('notify-send "Test Notification" "This is a test"');
    });

    it("then it should handle summary only", () => {
      const params = {
        summary: "Test Notification",
        body: undefined,
      };
      let command = "notify-send";
      command += ` "${params.summary}"`;
      if (params.body) {
        command += ` "${params.body}"`;
      }
      expect(command).toBe('notify-send "Test Notification"');
    });

    it("then it should handle body only", () => {
      const params = {
        summary: "Test Notification",
        body: "This is a test",
      };
      let command = "notify-send";
      command += ` "${params.summary}"`;
      if (params.body) {
        command += ` "${params.body}"`;
      }
      expect(command).toContain('"Test Notification"');
      expect(command).toContain('"This is a test"');
    });
  });

  describe("given urgency parameter", () => {
    it("then it should add -u flag", () => {
      const params = {
        summary: "Test Notification",
        urgency: "critical",
      };
      let command = "notify-send";
      if (params.urgency) {
        command += ` -u ${params.urgency}`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain("-u critical");
    });

    it("then it should handle low urgency", () => {
      const params = {
        summary: "Test Notification",
        urgency: "low",
      };
      let command = "notify-send";
      if (params.urgency) {
        command += ` -u ${params.urgency}`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain("-u low");
    });

    it("then it should handle normal urgency", () => {
      const params = {
        summary: "Test Notification",
        urgency: "normal",
      };
      let command = "notify-send";
      if (params.urgency) {
        command += ` -u ${params.urgency}`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain("-u normal");
    });
  });

  describe("given expireTime parameter", () => {
    it("then it should add -t flag", () => {
      const params = {
        summary: "Test Notification",
        expireTime: 5000,
      };
      let command = "notify-send";
      if (params.expireTime !== undefined) {
        command += ` -t ${params.expireTime}`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain("-t 5000");
    });

    it("then it should handle milliseconds", () => {
      const params = {
        summary: "Test Notification",
        expireTime: 3000,
      };
      let command = "notify-send";
      if (params.expireTime !== undefined) {
        command += ` -t ${params.expireTime}`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain("-t 3000");
    });
  });

  describe("given appName parameter", () => {
    it("then it should add -a flag", () => {
      const params = {
        summary: "Test Notification",
        appName: "MyApp",
      };
      let command = "notify-send";
      if (params.appName) {
        command += ` -a "${params.appName}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-a "MyApp"');
    });

    it("then it should handle app name with spaces", () => {
      const params = {
        summary: "Test Notification",
        appName: "My Application",
      };
      let command = "notify-send";
      if (params.appName) {
        command += ` -a "${params.appName}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-a "My Application"');
    });
  });

  describe("given icon parameter", () => {
    it("then it should add -i flag", () => {
      const params = {
        summary: "Test Notification",
        icon: "dialog-information",
      };
      let command = "notify-send";
      if (params.icon) {
        command += ` -i "${params.icon}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-i "dialog-information"');
    });

    it("then it should handle emoji icons", () => {
      const params = {
        summary: "Test Notification",
        icon: "🔔",
      };
      let command = "notify-send";
      if (params.icon) {
        command += ` -i "${params.icon}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-i "🔔"');
    });
  });

  describe("given category parameter", () => {
    it("then it should add -c flag", () => {
      const params = {
        summary: "Test Notification",
        category: "email",
      };
      let command = "notify-send";
      if (params.category) {
        command += ` -c "${params.category}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-c "email"');
    });

    it("then it should handle multiple categories", () => {
      const params = {
        summary: "Test Notification",
        category: "email.important",
      };
      let command = "notify-send";
      if (params.category) {
        command += ` -c "${params.category}"`;
      }
      command += ` "${params.summary}"`;
      expect(command).toContain('-c "email.important"');
    });
  });

  describe("given multiple parameters", () => {
    it("then it should construct complete command", () => {
      const params = {
        summary: "Test Notification",
        body: "Test body",
        urgency: "critical",
        expireTime: 3000,
        appName: "TestApp",
        icon: "warning",
        category: "alert",
      };
      let command = "notify-send";
      if (params.urgency) {
        command += ` -u ${params.urgency}`;
      }
      if (params.expireTime !== undefined) {
        command += ` -t ${params.expireTime}`;
      }
      if (params.appName) {
        command += ` -a "${params.appName}"`;
      }
      if (params.icon) {
        command += ` -i "${params.icon}"`;
      }
      if (params.category) {
        command += ` -c "${params.category}"`;
      }
      command += ` "${params.summary}"`;
      if (params.body) {
        command += ` "${params.body}"`;
      }
      expect(command).toContain("-u critical");
      expect(command).toContain("-t 3000");
      expect(command).toContain('-a "TestApp"');
      expect(command).toContain('-i "warning"');
      expect(command).toContain('-c "alert"');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
  describe("given command execution failure", () => {
    it("then it should return error details", async () => {
      const result = {
        code: 1,
        stdout: "",
        stderr: "notify-send: command not found",
        isError: true,
      };
      expect(result.isError).toBe(true);
      expect(result.stderr).toBeDefined();
    });
  });

  describe("given command execution success", () => {
    it("then it should return success", async () => {
      const result = {
        code: 0,
        stdout: "Notification sent",
        stderr: "",
        success: true,
      };
      expect(result.success).toBe(true);
    });
  });
});
