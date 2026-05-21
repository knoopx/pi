import { describe, it, expect } from "vitest";
import { formatContext7Result, formatLibraryList } from "./formatting";

describe("formatContext7Result", () => {
  it("returns no results message for empty array", () => {
    const result = formatContext7Result({
      query: "test",
      results: [],
    });
    expect(result).toBe("No documentation snippets found.");
  });

  it("formats a single code snippet", () => {
    const result = formatContext7Result({
      query: "test",
      results: [
        {
          type: "code",
          library: "/@react/react",
          title: "React useState",
          snippet: "const [state, setState] = useState(initialValue);",
          url: "https://react.dev/reference/react/useState",
          language: "typescript",
        },
      ],
    });
    expect(result).toContain("1 snippet");
    expect(result).toContain("React useState");
  });

  it("truncates long snippets", () => {
    const result = formatContext7Result({
      query: "test",
      results: [
        {
          library: "",
          type: "info",
          title: "Long snippet",
          snippet: "x".repeat(300),
          url: "https://example.com",
        },
      ],
    });
    expect(result).toContain("...");
  });

  it("includes library label when present", () => {
    const result = formatContext7Result({
      query: "test",
      results: [
        { library: "", type: "info", title: "x", snippet: "s", url: "u" },
      ],
      library: { id: "react" },
    });
    expect(result).toContain("· react");
  });
});

describe("formatLibraryList", () => {
  it("returns no libraries message for empty array", () => {
    const result = formatLibraryList({
      query: "test",
      libraries: [],
    });
    expect(result).toBe('No libraries found for "test".');
  });

  it("formats a library with trust score", () => {
    const result = formatLibraryList({
      query: "test",
      libraries: [
        {
          id: "react",
          title: "React",
          totalSnippets: 100,
          trustScore: 4.5,
          description: "A JavaScript library",
          versions: ["18.0.0", "19.0.0"],
        },
      ],
    });
    expect(result).toContain("1 library");
    expect(result).toContain("react · 4.5 trust");
    expect(result).toContain("18.0.0, 19.0.0");
  });

  it("handles library without description", () => {
    const result = formatLibraryList({
      query: "test",
      libraries: [
        {
          id: "test-lib",
          title: "Test Lib",
          totalSnippets: 50,
          trustScore: 3.0,
          description: "",
          versions: ["1.0.0"],
        },
      ],
    });
    expect(result).toContain("test-lib · 3.0 trust");
  });
});
