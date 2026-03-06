import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  truncateHead,
  DEFAULT_MAX_BYTES,
  formatSize,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "child_process";
import path from "path";

const TIMEOUT_MS = 1000;
const MAX_RESULTS = 1000;

const findSchema = Type.Object({
  pattern: Type.String({
    description:
      "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
  }),
  path: Type.Optional(
    Type.String({
      description: "Directory to search in (default: current directory)",
    }),
  ),
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "find",
    label: "find",
    description: `Search for files by glob pattern using fd. Returns matching file paths relative to the search directory. Respects .gitignore. Aborts if the search takes longer than ${TIMEOUT_MS}ms or returns more than ${MAX_RESULTS} results — narrow your pattern if that happens.`,
    parameters: findSchema,
    promptGuidelines: [
      "Always use specific glob patterns. Broad patterns like '*' or '**/*' will be rejected.",
      `Searches that exceed ${TIMEOUT_MS}ms or ${MAX_RESULTS} results are aborted. Narrow the pattern or target a subdirectory.`,
    ],

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const { pattern, path: searchDir } = params;
      const searchPath = searchDir
        ? path.resolve(process.cwd(), searchDir)
        : process.cwd();

      const shouldMatchFullPath =
        pattern.includes("/") || pattern.includes("\\");

      const args = [
        "--glob",
        "--color=never",
        "--hidden",
        ...(shouldMatchFullPath ? ["--full-path"] : []),
        pattern,
        searchPath,
      ];

      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Operation aborted"));
          return;
        }

        const child = spawn("fd", args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            content: [
              {
                type: "text",
                text: `Search aborted: exceeded ${TIMEOUT_MS}ms timeout. The pattern "${pattern}" is too broad — use a more specific glob or target a subdirectory.`,
              },
            ],
            details: undefined,
          });
        }, TIMEOUT_MS);

        const onAbort = () => {
          clearTimeout(timeout);
          child.kill();
          reject(new Error("Operation aborted"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        let stdout = "";
        let stderr = "";
        let lineCount = 0;
        let tooMany = false;

        child.stdout.on("data", (chunk: Buffer) => {
          if (tooMany) return;
          stdout += chunk.toString();
          lineCount = stdout.split("\n").filter(Boolean).length;
          if (lineCount > MAX_RESULTS) {
            tooMany = true;
            child.kill();
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on("close", (code) => {
          clearTimeout(timeout);
          signal?.removeEventListener("abort", onAbort);

          if (tooMany) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Search aborted: exceeded ${MAX_RESULTS} results. The pattern "${pattern}" is too broad — use a more specific glob or target a subdirectory.`,
                },
              ],
              details: undefined,
            });
            return;
          }

          const output = stdout.trim();

          if (code !== 0 && !output) {
            const msg = stderr.trim() || `fd exited with code ${code}`;
            reject(new Error(msg));
            return;
          }

          if (!output) {
            resolve({
              content: [
                { type: "text", text: "No files found matching pattern" },
              ],
              details: undefined,
            });
            return;
          }

          const lines = output
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => path.relative(searchPath, l));

          const raw = lines.join("\n");
          const truncation = truncateHead(raw, {
            maxLines: Number.MAX_SAFE_INTEGER,
          });
          let text = truncation.content;

          if (truncation.truncated) {
            text += `\n\n[${formatSize(DEFAULT_MAX_BYTES)} limit reached]`;
          }

          resolve({
            content: [{ type: "text", text }],
            details: truncation.truncated ? { truncation } : undefined,
          });
        });

        child.on("error", (err) => {
          clearTimeout(timeout);
          signal?.removeEventListener("abort", onAbort);
          reject(new Error(`Failed to run fd: ${err.message}`));
        });
      });
    },
  });
}
