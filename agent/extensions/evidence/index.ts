import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { randomBytes } from "node:crypto";
import {
  resetSessionStore,
  getSessionStore,
} from "../../shared/evidence-store";

const SNIPPET_CAP = 1024;

const BRIDGE_TEMPLATE = (n: number): string =>
  `[Preserved evidence from earlier in the conversation follows.] ` +
  `${n} evidence entr${n === 1 ? "y remains" : "ies remain"} available via ` +
  `evidence-list and evidence-get.`;

const entries = getSessionStore();

function makeError(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    details: {} as const,
    isError: true as const,
  };
}

const FIELD_ERRORS: Record<string, string> = {
  source: "source is required (URL or identifier)",
  note: "note is required (1-line summary of the snippet)",
  snippet: "snippet is required",
};

function firstMissing(values: Record<string, string>): string | null {
  for (const key of ["source", "note", "snippet"] as const) {
    if (!values[key]) return FIELD_ERRORS[key];
  }
  return null;
}

function validateEvidenceAdd(
  source: string,
  note: string,
  snippet: string,
):
  | { source: string; note: string; snippet: string }
  | {
      isError: true;
      content: { type: "text"; text: string }[];
      details: Record<string, never>;
    } {
  const trimmed = {
    source: (source ?? "").trim(),
    note: (note ?? "").trim(),
    snippet: snippet ?? "",
  };
  const missing = firstMissing(trimmed);
  if (missing) return makeError(`Error: ${missing}`);

  let sn = trimmed.snippet;
  if (sn.length > SNIPPET_CAP) {
    sn =
      sn.slice(0, SNIPPET_CAP) +
      `\n[... snippet truncated, kept ${SNIPPET_CAP} chars ...]`;
  }

  return { source: trimmed.source, note: trimmed.note, snippet: sn };
}

export default function (pi: ExtensionAPI) {
  pi.on("session_shutdown", async () => {
    resetSessionStore();
  });

  pi.on("session_compact", async (_event, ctx) => {
    const store = getSessionStore();
    if (store.length === 0) return;
    ctx.ui.notify(
      `evidence: ${store.length} evidence entries preserved across compaction`,
      "info",
    );
    pi.sendUserMessage(BRIDGE_TEMPLATE(store.length), {
      deliverAs: "followUp",
    });
  });

  pi.registerTool({
    name: "evidence-add",
    label: "Add Evidence",
    description:
      "Save a short evidence snippet with its source and a one-line note. " +
      "Use for any fact you will cite in your final answer. Snippet is capped at 1KB.",
    parameters: Type.Object({
      source: Type.String({ description: "URL or identifier of origin" }),
      note: Type.String({ description: "One-line summary for later recall" }),
      snippet: Type.String({ description: "The exact citable span (<=1KB)" }),
    }),
    async execute(_id, { source, note, snippet }) {
      const result = validateEvidenceAdd(source, note, snippet);
      if ("isError" in result) {
        return result as any;
      }
      const id = "e" + randomBytes(3).toString("hex");
      entries.push({
        id,
        source: result.source,
        note: result.note,
        snippet: result.snippet,
      });
      return {
        content: [{ type: "text", text: `stored ${id}: ${result.note}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "evidence-get",
    label: "Get Evidence",
    description: "Retrieve a previously-saved evidence entry by its id.",
    parameters: Type.Object({
      id: Type.String({ description: "Evidence id from evidence-add/list" }),
    }),
    async execute(_id, { id }) {
      const eid = (id ?? "").trim();
      if (!eid) {
        return makeError("Error: id is required");
      }
      const e = entries.find((x) => x.id === eid);
      if (!e) {
        return makeError(`Error: evidence id '${eid}' not found`);
      }
      return {
        content: [
          {
            type: "text",
            text: `[${e.id}] source: ${e.source}\nnote: ${e.note}\nsnippet:\n${e.snippet}`,
          },
        ],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "evidence-list",
    label: "List Evidence",
    description:
      "List all evidence entries in this session: id, source, one-line note.",
    parameters: Type.Object({}),
    async execute() {
      if (entries.length === 0) {
        return {
          content: [{ type: "text", text: "(no evidence stored yet)" }],
          details: {},
        };
      }
      const lines = entries.map((e) => `${e.id}\t${e.source}\t${e.note}`);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {},
      };
    },
  });
}
