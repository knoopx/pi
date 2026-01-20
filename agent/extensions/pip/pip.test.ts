import { describe, it, expect, beforeEach, vi } from "vitest";
import setupPipToolsExtension from "./index";

describe("Scenario: Pip Tools Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    setupPipToolsExtension(mockPi);
  });

  it("should register pip tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pip-search",
        label: "Pip Search",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pip-show",
        label: "Pip Show",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pip-list",
        label: "Pip List",
      }),
    );
  });

  describe("Given pip-search tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "pip-search",
      )[0];
    });

    it("should search packages successfully", async () => {
      const mockPackages = [
        {
          name: "requests",
          version: "2.31.0",
          description: "Python HTTP for Humans.",
        },
        {
          name: "requests-oauthlib",
          version: "1.3.1",
          description: "OAuthlib authentication support for Requests.",
        },
      ];

      const mockResult = {
        code: 0,
        stdout: JSON.stringify(mockPackages),
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {
        query: "requests",
        limit: 5,
      });

      expect(mockPi.exec).toHaveBeenCalledWith(
        "pip",
        ["search", "requests", "--format", "json"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Found 2 package(s) matching");
      expect(result.content[0].text).toContain("**requests** (2.31.0)");
      expect(result.content[0].text).toContain("Python HTTP for Humans.");
      expect(result.details.query).toBe("requests");
      expect(result.details.total).toBe(2);
    });

    it("should use default limit when not provided", async () => {
      const mockResult = {
        code: 0,
        stdout: JSON.stringify([]),
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", { query: "test" });

      // Should still work with empty results
      expect(mockPi.exec).toHaveBeenCalledWith(
        "pip",
        ["search", "test", "--format", "json"],
        { signal: undefined },
      );
    });

    it("should handle pip search errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "pip search failed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.content[0].text).toContain("Error searching for packages");
    });

    it("should handle JSON parse errors", async () => {
      const mockResult = {
        code: 0,
        stdout: "invalid json",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", { query: "test" });

      expect(result.content[0].text).toContain("Error parsing search results");
    });
  });

  describe("Given pip-show tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "pip-show",
      )[0];
    });

    it("should show package info successfully", async () => {
      const pipShowOutput = `Name: requests
Version: 2.31.0
Summary: Python HTTP for Humans.
Home-page: https://requests.readthedocs.io/
Author: Kenneth Reitz
License: Apache 2.0
Location: /usr/lib/python3.11/site-packages
Requires: urllib3, certifi, charset-normalizer, idna
Required-by: pip-tools, requests-oauthlib`;

      const mockResult = {
        code: 0,
        stdout: pipShowOutput,
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {
        package: "requests",
      });

      expect(mockPi.exec).toHaveBeenCalledWith("pip", ["show", "requests"], {
        signal: undefined,
      });
      expect(result.content[0].text).toContain("Package: requests");
      expect(result.content[0].text).toContain("**Version:** 2.31.0");
      expect(result.content[0].text).toContain(
        "**Summary:** Python HTTP for Humans.",
      );
      expect(result.content[0].text).toContain("**Author:** Kenneth Reitz");
      expect(result.content[0].text).toContain(
        "**Requires:** urllib3, certifi, charset-normalizer, idna",
      );
      expect(result.details.package).toBe("requests");
    });

    it("should handle package not found", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Package 'nonexistent' is not installed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {
        package: "nonexistent",
      });

      expect(result.content[0].text).toContain(
        'Package "nonexistent" not found',
      );
    });
  });

  describe("Given pip-list tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "pip-list",
      )[0];
    });

    it("should list packages in table format", async () => {
      const pipListOutput = `Package    Version
------     -------
pip         23.2.1
setuptools  68.0.0
wheel       0.41.2`;

      const mockResult = {
        code: 0,
        stdout: pipListOutput,
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", { format: "table" });

      expect(mockPi.exec).toHaveBeenCalledWith("pip", ["list"], {
        signal: undefined,
      });
      expect(result.content[0].text).toContain("Installed packages");
      expect(result.content[0].text).toContain(pipListOutput);
      expect(result.details.format).toBe("table");
      expect(result.details.count).toBe(3);
    });

    it("should list outdated packages", async () => {
      const mockResult = {
        code: 0,
        stdout:
          "Package    Version    Latest    Type\npip         23.2.1      23.3.1     wheel",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {
        format: "table",
        outdated: true,
      });

      expect(mockPi.exec).toHaveBeenCalledWith("pip", ["list", "--outdated"], {
        signal: undefined,
      });
      expect(result.content[0].text).toContain("Outdated packages");
      expect(result.details.outdated).toBe(true);
    });

    it("should handle JSON format", async () => {
      const mockPackages = [
        { name: "pip", version: "23.2.1" },
        { name: "setuptools", version: "68.0.0" },
      ];

      const mockResult = {
        code: 0,
        stdout: JSON.stringify(mockPackages),
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", { format: "json" });

      expect(mockPi.exec).toHaveBeenCalledWith(
        "pip",
        ["list", "--format", "json"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("**pip** 23.2.1");
      expect(result.content[0].text).toContain("**setuptools** 68.0.0");
      expect(result.details.format).toBe("json");
    });

    it("should handle freeze format", async () => {
      const pipFreezeOutput = `pip==23.2.1
setuptools==68.0.0
wheel==0.41.2`;

      const mockResult = {
        code: 0,
        stdout: pipFreezeOutput,
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {
        format: "freeze",
      });

      expect(mockPi.exec).toHaveBeenCalledWith(
        "pip",
        ["list", "--format", "freeze"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Installed packages");
      expect(result.content[0].text).toContain(pipFreezeOutput);
      expect(result.details.format).toBe("freeze");
    });

    it("should handle pip list errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "pip list failed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {});

      expect(result.content[0].text).toContain("Error listing packages");
    });
  });
});
