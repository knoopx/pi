import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type RenderResultDetails = {
  rendered?: boolean;
  format?: "svg" | "png";
  outputFile?: string | null;
  attached?: boolean;
  error?: string;
  message?: string;
  cancelled?: boolean;
};

type RenderUpdateDetails = { status: "rendering" };

type RenderResponseContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

function normalizePiPath(path: string): string {
  return path.startsWith("@") ? path.slice(1) : path;
}

async function renderNomnomlToSvg(source: string): Promise<string> {
  const mod = (await import("nomnoml")) as unknown as {
    renderSvg?: (src: string) => string;
    default?: { renderSvg?: (src: string) => string };
  };

  const renderSvg = mod.renderSvg ?? mod.default?.renderSvg;
  if (!renderSvg) {
    throw new Error("nomnoml.renderSvg is not available");
  }

  return renderSvg(source);
}

function buildInputError(
  message: string,
  error: string,
): AgentToolResult<RenderResultDetails> {
  return {
    content: [{ type: "text" as const, text: message }],
    details: { error, message },
  };
}

function cancelledResult(): AgentToolResult<RenderResultDetails> {
  return {
    content: [{ type: "text", text: "Cancelled." }],
    details: { cancelled: true },
  };
}

async function resolveDiagramSource(params: {
  source?: string;
  inputFile?: string;
}): Promise<{
  diagramSource?: string;
  error?: AgentToolResult<RenderResultDetails>;
}> {
  const { source, inputFile } = params;

  if ((source && inputFile) || (!source && !inputFile)) {
    return {
      error: buildInputError(
        "Provide exactly one of: source or inputFile.",
        "source_xor_inputFile",
      ),
    };
  }

  if (source) {
    return { diagramSource: source };
  }

  const content = await readFile(normalizePiPath(inputFile as string), "utf8");
  return { diagramSource: content };
}

async function renderPng(svg: string) {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(svg, "utf8")).png().toBuffer();
}

async function renderDiagram(
  diagramSource: string,
  outputFile: string | undefined,
  onUpdate: AgentToolUpdateCallback<RenderUpdateDetails> | undefined,
): Promise<AgentToolResult<RenderResultDetails>> {
  try {
    onUpdate?.({
      content: [{ type: "text", text: "Rendering nomnoml diagram..." }],
      details: { status: "rendering" },
    });

    const svg = await renderNomnomlToSvg(diagramSource);

    let savedPath: string | null = null;
    if (outputFile) {
      const normalized = normalizePiPath(outputFile);
      await mkdir(dirname(normalized), { recursive: true });
      await writeFile(normalized, svg, "utf8");
      savedPath = normalized;
    }

    const pngBuffer = await renderPng(svg);

    const content: RenderResponseContent[] = [
      {
        type: "image",
        mimeType: "image/png",
        data: pngBuffer.toString("base64"),
      },
    ];

    if (savedPath) {
      content.unshift({ type: "text", text: `Saved SVG to: ${savedPath}` });
    }

    return {
      content,
      details: {
        rendered: true,
        format: "png",
        outputFile: savedPath,
        attached: true,
      },
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error rendering diagram: ${String(error)}`,
        },
      ],
      details: { error: String(error) },
    };
  }
}

export default function nomnomlExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "nomnoml-display",
    label: "Render nomnoml diagram (preview)",
    description: `Render a nomnoml (text-to-UML) diagram and attach it as a PNG image.

Use this to:
- Preview a diagram without writing a file
- Render ad-hoc nomnoml snippets
- Attach diagram output to the chat
`,

    parameters: Type.Object({
      source: Type.Optional(
        Type.String({
          description: "Nomnoml source text (e.g. '[A]->[B]')",
        }),
      ),
      inputFile: Type.Optional(
        Type.String({
          description: "Path to a .nomnoml text file to render",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      if (signal?.aborted) {
        return cancelledResult();
      }

      const resolved = await resolveDiagramSource(
        params as {
          source?: string;
          inputFile?: string;
        },
      );

      if (resolved.error) {
        return resolved.error;
      }

      return renderDiagram(
        resolved.diagramSource as string,
        undefined,
        onUpdate,
      );
    },
  });

  pi.registerTool({
    name: "nomnoml-render",
    label: "Render nomnoml",
    description:
      "Render a nomnoml (text-to-UML) diagram locally (no server).\n\n" +
      "Returns the SVG as an image attachment.\n" +
      "You can also save the SVG to disk via outputFile.",

    parameters: Type.Object({
      source: Type.String({
        description: "Nomnoml source text (e.g. '[A]->[B]')",
      }),
      outputFile: Type.Optional(
        Type.String({
          description:
            "Optional output path to write the rendered SVG (directories are created)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const { source, outputFile } = params as {
        source: string;
        outputFile?: string;
      };

      if (signal?.aborted) {
        return cancelledResult();
      }

      return renderDiagram(source, outputFile, onUpdate);
    },
  });

  pi.registerTool({
    name: "nomnoml-render-file",
    label: "Render nomnoml file",
    description:
      "Render a nomnoml (text-to-UML) diagram from a .nomnoml file.\n\n" +
      "Returns the SVG as an image attachment.\n" +
      "You can also save the SVG to disk via outputFile.",

    parameters: Type.Object({
      inputFile: Type.String({
        description: "Path to a .nomnoml text file to render",
      }),
      outputFile: Type.Optional(
        Type.String({
          description:
            "Optional output path to write the rendered SVG (directories are created)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const { inputFile, outputFile } = params as {
        inputFile: string;
        outputFile?: string;
      };

      if (signal?.aborted) {
        return cancelledResult();
      }

      const diagramSource = await readFile(normalizePiPath(inputFile), "utf8");

      return renderDiagram(diagramSource, outputFile, onUpdate);
    },
  });
}
