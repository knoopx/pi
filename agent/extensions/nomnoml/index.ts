import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function normalizePiPath(path: string): string {
  // Built-in tools accept @path (from file picker). Mirror that behavior.
  return path.startsWith("@") ? path.slice(1) : path;
}

async function renderNomnomlToSvg(source: string): Promise<string> {
  // nomnoml is published as CommonJS; depending on the runtime/bundler we may
  // see its exports either on the module itself or under `default`.
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

export default function nomnomlExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "render_nomnoml",
    label: "Render nomnoml",
    description:
      "Render a nomnoml (text-to-UML) diagram locally (no server).\n\n" +
      "Returns the SVG as an image attachment.\n" +
      "You can also save the SVG to disk via outputFile.",

    parameters: Type.Union([
      Type.Object({
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
      Type.Object({
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
    ]),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { source, inputFile, outputFile } = params as {
        source?: string;
        inputFile?: string;
        outputFile?: string;
      };

      if (signal?.aborted) {
        return {
          content: [{ type: "text", text: "Cancelled." }],
          details: { cancelled: true },
        };
      }

      const shouldAttach = true;

      try {
        onUpdate?.({
          content: [{ type: "text", text: "Rendering nomnoml diagram..." }],
          details: { status: "rendering" },
        });

        const diagramSource =
          source ??
          (await readFile(normalizePiPath(inputFile as string), "utf8"));

        const svg = await renderNomnomlToSvg(diagramSource);

        let savedPath: string | null = null;
        if (outputFile) {
          const normalized = normalizePiPath(outputFile);
          await mkdir(dirname(normalized), { recursive: true });
          await writeFile(normalized, svg, "utf8");
          savedPath = normalized;
        }

        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];

        const summaryParts: string[] = ["Rendered nomnoml diagram."];
        if (savedPath) {
          summaryParts.push(`Saved SVG to: ${savedPath}`);
        }

        content.push({ type: "text", text: summaryParts.join(" ") });

        content.push({
          type: "image",
          mimeType: "image/svg+xml",
          data: Buffer.from(svg, "utf8").toString("base64"),
        });

        return {
          content,
          details: {
            rendered: true,
            format: "svg",
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
    },
  });
}
