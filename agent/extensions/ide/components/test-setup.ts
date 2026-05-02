import { vi } from "vitest";
import type * as fsPromises from "node:fs/promises";

type ImportOriginal = () => Promise<typeof fsPromises>;
vi.mock("node:fs/promises", async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal();
  const { mockReadFileImplementation } = await import("./files/test-helpers");
  return {
    ...actual,
    readFile: vi.fn().mockImplementation(mockReadFileImplementation),
  };
});
