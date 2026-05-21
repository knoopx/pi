import type { SearchSourcegraphParamsType, SourcegraphResult } from "./types";
export {
  SearchSourcegraphParams,
  type SearchSourcegraphParamsType,
} from "./types";

const DEFAULT_BASE_URL = "https://sourcegraph.com";

interface SSEContentMatch {
  type: string;
  repository: string;
  path: string;
  language: string;
  repoStars: number;
  lineMatches: SSELineMatch[];
}

interface SSELineMatch {
  line: string;
  lineNumber: number;
}

function buildQuery(query: string, language?: string): string {
  let q = query;
  if (language) {
    q += ` lang:${language}`;
  }
  if (!q.includes("archived:")) {
    q += " archived:no";
  }
  if (!q.includes("fork:")) {
    q += " fork:no";
  }
  return q;
}

function extractResultsFromMatches(
  matches: SSEContentMatch[],
  baseUrl: string,
): SourcegraphResult[] {
  const results: SourcegraphResult[] = [];
  for (const match of matches) {
    if (match.type !== "content" || match.lineMatches.length === 0) continue;
    const lm = match.lineMatches[0];
    results.push({
      repo: match.repository,
      path: match.path,
      line: lm.lineNumber,
      snippet: lm.line,
      language: match.language,
      stars: match.repoStars,
      url: `${baseUrl}/${match.repository}/-/blob/${match.path}#L${lm.lineNumber}`,
    });
  }
  return results;
}

function parseEventType(trimmed: string): string | null {
  if (trimmed.startsWith("event:")) return trimmed.slice(6).trim();
  return null;
}

function parseSseData(trimmed: string): SSEContentMatch[] | null {
  const data = trimmed.slice(5).trim();
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function parseSseLine(
  line: string,
  eventType: string,
): { newEventType: string; matches?: SSEContentMatch[] } {
  const trimmed = line.trim();
  if (!trimmed) return { newEventType: eventType };
  const event = parseEventType(trimmed);
  if (event) return { newEventType: event };
  if (!isMatchingDataLine(trimmed, eventType)) {
    return { newEventType: eventType };
  }
  const matches = parseSseData(trimmed);
  return { newEventType: eventType, matches: matches ?? undefined };
}

function isMatchingDataLine(trimmed: string, eventType: string): boolean {
  return trimmed.startsWith("data:") && eventType === "matches";
}

function processSseLines(
  lines: string[],
  eventType: string,
  baseUrl: string,
): { newEventType: string; results: SourcegraphResult[] } {
  const results: SourcegraphResult[] = [];
  let currentEventType = eventType;

  for (const line of lines) {
    const { newEventType, matches } = parseSseLine(line, currentEventType);
    currentEventType = newEventType;
    if (matches) {
      results.push(...extractResultsFromMatches(matches, baseUrl));
    }
  }

  return { newEventType: currentEventType, results };
}

function extractCompleteLines(buffer: string): {
  lines: string[];
  remainder: string;
} {
  const lines = buffer.split("\n");
  return { lines, remainder: lines.pop() ?? "" };
}

async function parseSSE(
  response: Response,
  limit: number,
  baseUrl: string,
): Promise<SourcegraphResult[]> {
  const results: SourcegraphResult[] = [];
  if (!response.body) return results;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";

  while (results.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { lines, remainder } = extractCompleteLines(buffer);
    buffer = remainder;

    const { newEventType, results: newResults } = processSseLines(
      lines,
      eventType,
      baseUrl,
    );
    eventType = newEventType;
    results.push(...newResults);
    if (results.length >= limit) return results;
  }

  return results;
}

async function searchSourcegraph(params: SearchSourcegraphParamsType) {
  const { query, limit = 20, language } = params;
  const baseUrl = process.env.SOURCEGRAPH_URL ?? DEFAULT_BASE_URL;
  const fullQuery = buildQuery(query, language);

  const url = `${baseUrl}/.api/search/stream?q=${encodeURIComponent(fullQuery)}&display=${limit}`;

  const response = await fetch(url, {
    headers: { Accept: "text/event-stream" },
  });

  if (!response.ok) {
    throw new Error(`Sourcegraph returned status ${response.status}`);
  }

  const results = await parseSSE(response, limit, baseUrl);
  return { query, results };
}

export { searchSourcegraph };
