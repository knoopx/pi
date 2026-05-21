import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Context7DocResult,
  Context7Library,
  SearchContext7ParamsType,
} from "./types";
export { SearchContext7Params, type SearchContext7ParamsType } from "./types";

const API_BASE = "https://context7.com/api";

function getApiKey(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  const authPath = join(agentDir, "auth.json");
  try {
    const raw = readFileSync(authPath, "utf-8");
    const auth = JSON.parse(raw);
    if (auth.context7?.key) {
      return auth.context7.key;
    }
  } catch {
    // fall through to error
  }
  throw new Error(
    "Context7 API key not set. Add it to agent/auth.json under the context7 key.",
  );
}

interface CodeSnippet {
  codeTitle: string;
  codeDescription: string;
  codeLanguage: string;
  codeId: string;
  codeList: CodeEntry[];
}

interface CodeEntry {
  language: string;
  code: string;
}

interface InfoSnippet {
  pageId: string;
  breadcrumb: string;
  content: string;
}

interface Context7DocsResponse {
  codeSnippets: CodeSnippet[];
  infoSnippets: InfoSnippet[];
}

interface Context7SearchResponse {
  results: Context7Library[];
}

async function fetchContext7<T>(url: string): Promise<T> {
  const apiKey = getApiKey();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (response.status === 401) {
    throw new Error("Context7: invalid API key. Check agent/auth.json.");
  }
  if (!response.ok) {
    throw new Error(`Context7 returned status ${response.status}`);
  }

  return response.json();
}

async function resolveLibrary(name: string): Promise<Context7Library[]> {
  const url = `${API_BASE}/v1/search?query=${encodeURIComponent(name)}`;
  const body: Context7SearchResponse = await fetchContext7(url);
  return body.results;
}

async function getDocs(
  libraryId: string,
  query: string,
  tokens: number,
): Promise<Context7DocResult[]> {
  const url = `${API_BASE}/v2/context?libraryId=${encodeURIComponent(libraryId)}&query=${encodeURIComponent(query)}&type=json&tokens=${tokens}`;
  const body: Context7DocsResponse = await fetchContext7(url);
  return [
    ...processCodeSnippets(libraryId, body.codeSnippets),
    ...processInfoSnippets(libraryId, body.infoSnippets),
  ];
}

function processCodeSnippets(
  libraryId: string,
  snippets: CodeSnippet[],
): Context7DocResult[] {
  return snippets.map((cs) => ({
    library: libraryId,
    title: cs.codeTitle,
    snippet: cs.codeList[0]?.code ?? "",
    url: cs.codeId,
    type: "code" as const,
    language: cs.codeLanguage,
  }));
}

function processInfoSnippets(
  libraryId: string,
  snippets: InfoSnippet[],
): Context7DocResult[] {
  return snippets.map((is) => ({
    library: libraryId,
    title: is.breadcrumb,
    snippet: is.content,
    url: is.pageId,
    type: "info" as const,
  }));
}

async function searchContext7(params: SearchContext7ParamsType): Promise<{
  query: string;
  results: Context7DocResult[];
  library?: Context7Library;
}> {
  const { query, library, tokens = 4000 } = params;

  let libraryId: string;
  let resolvedLib: Context7Library | undefined;

  if (library) {
    // Explicit library ID provided, skip resolve
    libraryId = library;
  } else {
    // Auto-resolve library from query
    const libs = await resolveLibrary(query);
    if (libs.length === 0) {
      throw new Error(`Context7: no library found for "${query}"`);
    }
    resolvedLib = libs[0];
    libraryId = libs[0].id;
  }

  const results = await getDocs(libraryId, query, tokens);
  return { query, results, library: resolvedLib };
}

async function resolveContext7Library(
  name: string,
): Promise<{ query: string; libraries: Context7Library[] }> {
  const libraries = await resolveLibrary(name);
  return { query: name, libraries };
}

export { searchContext7, resolveContext7Library };
export type { Context7DocResult, Context7Library };
