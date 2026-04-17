import type {
  ExtensionAPI,
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const MARKITDOWN_PATH = `${process.env.HOME}/.local/bin/markitdown`;

function hasValidSignal(signal: unknown): signal is AbortSignal {
  return (
    signal instanceof AbortSignal &&
    typeof signal.addEventListener === "function"
  );
}

async function executeMarkitdown(
  pi: ExtensionAPI,
  source: string,
  signal: AbortSignal | undefined,
): Promise<ExecResult> {
  const isRemote = /^https?:\/\//i.test(source);

  if (isRemote) {
    const command = `curl -s -A 'Mozilla/5.0' -o - '${source}' | ${MARKITDOWN_PATH}`;
    return pi.exec(
      "bash",
      ["-c", command],
      hasValidSignal(signal) ? { signal } : undefined,
    ) as Promise<ExecResult>;
  }

  return pi.exec(
    MARKITDOWN_PATH,
    [source],
    hasValidSignal(signal) ? { signal } : undefined,
  ) as Promise<ExecResult>;
}

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

function buildSuccessResult(
  source: string,
  stdout: string,
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text" as const, text: stdout }],
    details: { source, converted: true },
  };
}

function buildErrorResult(
  source: string,
  result: { code: number; stdout?: string; stderr?: string },
): AgentToolResult<{ source: string }> {
  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  const errorMessage = [stderr, stdout, `Exit code: ${result.code}`]
    .filter(Boolean)
    .join("\n\n");

  return {
    content: [
      {
        type: "text" as const,
        text: errorMessage || `markitdown failed with exit code ${result.code}`,
      },
    ],
    details: { source, error: errorMessage, exitCode: result.code } as {
      source: string;
    } & Record<string, unknown>,
  };
}

function createExecuteMarkitdownTool(pi: ExtensionAPI) {
  return async function executeMarkitdownTool(
    _toolCallId: string,
    params: { source: string },
    signal: AbortSignal | undefined,
    onUpdate?: AgentToolUpdateCallback<unknown> | undefined,
    _ctx: ExtensionContext = {} as ExtensionContext,
  ): Promise<AgentToolResult<{ source: string }>> {
    const { source } = params;

    try {
      onUpdate?.({
        content: [
          {
            type: "text" as const,
            text: `Converting ${source} to Markdown...`,
          },
        ],
        details: { source, status: "converting" },
      });

      const result = await executeMarkitdown(pi, source, signal);

      if (result.code === 0)
        return buildSuccessResult(source, result.stdout) as AgentToolResult<{
          source: string;
        }>;

      return buildErrorResult(source, result);
    } catch (error) {
      return {
        content: [
          { type: "text" as const, text: `Unexpected error: ${error}` },
        ],
        details: { source, error: String(error) },
      } as AgentToolResult<{ source: string }>;
    }
  };
}

function createTool(pi: ExtensionAPI) {
  return {
    name: "transcribe",
    label: "Transcribe",
    description: `Convert various file formats and web content to Markdown text.

Use this to:
- Convert documents to readable text
- Extract content from PDFs and Office files
- Transcribe web pages to Markdown
- Process various file formats

Supports URLs and local files.`,
    parameters: Type.Object({
      source: Type.String({
        description: "URL or file path to transcribe into human-readable text",
      }),
    }),

    execute: createExecuteMarkitdownTool(pi),
  };
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createTool(pi));
}
