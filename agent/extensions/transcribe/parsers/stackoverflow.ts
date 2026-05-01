import { createRetryFetch, defineParser } from "../lib/parser-utils";
import { formatAge, formatNumber, stripHtml } from "../lib/formatters";
const BASE = "https://stackoverflow.com";
const API = "https://api.stackexchange.com/2.3";
const SO_FILTER = "!)3nIZKx6WpNKLbI7rOJ]GqFyHlAeLXvT4MR1YjUuQ0oCmDfE2gSb5t8w";
interface SoQuestion {
  question_id: number;
  title: string;
  link: string;
  score: number;
  answer_count: number;
  view_count: number;
  owner?: {
    display_name: string;
    user_id: number;
    link?: string;
    profile_image?: string;
  };
  tags: string[];
  is_answered?: boolean;
  last_activity_date?: number;
  creation_date?: number;
  snippet?: string;
  accepted_answer_id?: number;
}
interface SoAnswer {
  answer_id: number;
  score: number;
  is_accepted: boolean;
  owner?: {
    display_name: string;
    user_id: number;
    link?: string;
  };
  creation_date?: number;
  body?: string;
  title?: string;
}
interface SoApiPage<T> {
  items: T[];
  has_more: boolean;
  quota_remaining: number;
  total: number;
}
type SoKind = "question" | "questions" | "search" | "tagged" | "users" | "user";
interface ParsedSoUrl {
  kind: SoKind;
  questionId?: number;
  tag?: string;
  query?: string;
  sort?: string;
  userId?: number;
  userName?: string;
}
function parseStackOverflowUrl(url: string): ParsedSoUrl | null {
  const match = url.match(
    /^https?:\/\/(?:www\.)?stackoverflow\.com(?:\/(.+))?$/,
  );
  if (!match) return null;
  const fullPath = match[1]?.replace(/\/+$/, "") || "";
  if (!fullPath) return { kind: "questions" };
  const [pathPart, queryString] = fullPath.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(queryString || "");
  const first = parts[0].toLowerCase();

  return dispatchSoPath(first, parts, params);
}
function dispatchSoPath(
  first: string,
  parts: string[],
  params: URLSearchParams,
): ParsedSoUrl | null {
  if (first === "search") return tryParseSearch(params);
  if (first === "questions") return tryParseQuestionsPath(parts, params);
  if (first === "users") return tryParseUsersPath(parts);
  return null;
}
function tryParseSearch(params: URLSearchParams): ParsedSoUrl {
  const q = params.get("q") || "";
  const tab = params.get("tab") || "relevance";
  const sortMap: Record<string, string> = {
    relevance: "relevance",
    newest: "creation_date",
    votes: "votes",
    active: "activity",
  };
  return { kind: "search", query: q, sort: sortMap[tab] || "relevance" };
}
function tryParseQuestionsPath(
  parts: string[],
  params: URLSearchParams,
): ParsedSoUrl | null {
  if (parts[1] === "tagged" && parts[2]) {
    const tab = params.get("tab") || "votes";
    return { kind: "tagged", tag: parts[2], sort: tab };
  }
  const idResult = tryParseQuestionId(parts);
  if (idResult) return idResult;

  return { kind: "questions" };
}
function tryParseQuestionId(parts: string[]): ParsedSoUrl | null {
  if (!parts[1]) return null;
  const id = parseInt(parts[1], 10);
  if (!isNaN(id)) return { kind: "question", questionId: id };
  return null;
}
function tryParseUsersPath(parts: string[]): ParsedSoUrl | null {
  if (parts[1]) {
    const id = parseInt(parts[1], 10);
    if (!isNaN(id)) {
      return { kind: "user", userId: id, userName: parts[2] || "" };
    }
  }
  return { kind: "users" };
}

const soFetch = createRetryFetch({ apiName: "StackOverflow" });

async function fetchSoApi<T>(
  endpoint: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<SoApiPage<T>> {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  return soFetch<SoApiPage<T>>(url.toString(), signal);
}
function formatTags(tags: string[]): string {
  return tags.map((t) => `[${t}]`).join(" ");
}

async function handleQuestion(
  questionId: number,
  signal?: AbortSignal,
): Promise<string> {
  const qData = await fetchSoApi<SoQuestion>(
    `questions/${questionId}`,
    { filter: SO_FILTER },
    signal,
  );
  const question = qData.items[0];
  if (!question) throw new Error(`Question ${questionId} not found`);
  const parts: string[] = [`# ${question.title}`];
  if (question.tags.length) parts.push(formatTags(question.tags));
  parts.push(buildQuestionMeta(question), buildQuestionStats(question));

  if (question.snippet) {
    parts.push("", stripHtml(question.snippet));
  }

  await appendAnswers(parts, questionId, signal);

  parts.push("");
  parts.push(`[View on Stack Overflow](${question.link})`);
  return parts.join("\n");
}
function buildQuestionMeta(q: SoQuestion): string {
  const meta: string[] = [];
  if (q.owner) {
    meta.push(
      `asked by [${q.owner.display_name}](${q.owner.link || `${BASE}/users/${q.owner.user_id}`})`,
    );
  }
  if (q.creation_date) meta.push(formatAge(q.creation_date));
  return meta.join(" \u2022 ");
}
function buildQuestionStats(q: SoQuestion): string {
  return [
    `${formatNumber(q.score)} votes`,
    `${formatNumber(q.view_count)} views`,
    `${q.answer_count} answers`,
  ].join(" \u2022 ");
}

async function appendAnswers(
  parts: string[],
  questionId: number,
  signal?: AbortSignal,
): Promise<void> {
  const answersData = await fetchSoApi<SoAnswer>(
    `questions/${questionId}/answers`,
    { sort: "votes", order: "desc", filter: SO_FILTER },
    signal,
  );
  const answers = answersData.items;
  if (!answers.length) return;

  parts.push("", `## Answers (${answers.length})`, "");

  for (let i = 0; i < Math.min(answers.length, 5); i++) {
    if (i > 0) parts.push("");
    parts.push(...renderAnswer(answers[i]));
  }

  if (answers.length > 5) {
    parts.push("", `... and ${answers.length - 5} more answers`);
  }
}
function renderAnswer(a: SoAnswer): string[] {
  const acceptedBadge = a.is_accepted ? "\u2713 " : "";
  const lines: string[] = [
    `${acceptedBadge}**Answer** ${formatNumber(a.score)} votes`,
  ];

  if (a.owner) {
    lines.push(
      `by [${a.owner.display_name}](${a.owner.link || `${BASE}/users/${a.owner.user_id}`})`,
    );
  }

  if (a.body) {
    const body = stripHtml(a.body);
    lines.push("", body.length > 600 ? body.slice(0, 597) + "..." : body);
  }

  return lines;
}
function renderQuestionList(title: string, questions: SoQuestion[]): string[] {
  const lines: string[] = [`# ${title}`, ""];

  for (let i = 0; i < questions.length; i++) {
    if (i > 0) lines.push("");
    lines.push(...renderQuestionItem(i + 1, questions[i]));
  }

  return lines;
}
function renderQuestionItem(rank: number, q: SoQuestion): string[] {
  const meta: string[] = [
    `${formatNumber(q.score)} votes`,
    `${q.answer_count} answers`,
    `${formatNumber(q.view_count)} views`,
  ];
  if (q.owner) meta.push(`by ${q.owner.display_name}`);
  if (q.last_activity_date) meta.push(formatAge(q.last_activity_date));
  const lines: string[] = [`**${rank}. ${q.title}**`, meta.join(" \u2022 ")];
  if (q.tags.length) lines.push(formatTags(q.tags));

  if (q.snippet) {
    const snippet = stripHtml(q.snippet);
    lines.push(snippet.length > 200 ? snippet.slice(0, 197) + "..." : snippet);
  }

  lines.push(`[\u2197 stackoverflow](${q.link})`);
  return lines;
}

async function handleSearch(
  query: string,
  sort: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchSoApi<SoQuestion>(
    "search",
    {
      q: query,
      order: "desc",
      sort,
      pagesize: "20",
      filter: SO_FILTER,
    },
    signal,
  );
  const lines = renderQuestionList(
    `Stack Overflow — Search "${query}"`,
    data.items,
  );
  return lines.join("\n");
}

async function handleTagged(
  tag: string,
  sort: string,
  signal?: AbortSignal,
): Promise<string> {
  const sortMap: Record<string, string> = {
    newest: "creation_date",
    active: "activity",
    bounties: "bounty",
    unanswered: "unanswered",
    frequent: "frequent",
    votes: "votes",
  };
  const data = await fetchSoApi<SoQuestion>(
    `questions/tagged/${tag}`,
    {
      order: "desc",
      sort: sortMap[sort] || "votes",
      pagesize: "20",
      filter: SO_FILTER,
    },
    signal,
  );
  const lines = renderQuestionList(
    `Stack Overflow — Tagged [${tag}] (${data.total} questions)`,
    data.items,
  );
  return lines.join("\n");
}

async function handleQuestions(signal?: AbortSignal): Promise<string> {
  const data = await fetchSoApi<SoQuestion>(
    "questions",
    {
      order: "desc",
      sort: "creation_date",
      pagesize: "20",
      filter: SO_FILTER,
    },
    signal,
  );
  const lines = renderQuestionList(
    "Stack Overflow — Latest Questions",
    data.items,
  );
  return lines.join("\n");
}
function dispatchSo(
  parsed: ParsedSoUrl,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<SoKind, () => Promise<string>> = {
    question: () => {
      if (!parsed.questionId)
        throw new Error("Missing Stack Overflow question id");
      return handleQuestion(parsed.questionId, signal);
    },
    search: () =>
      handleSearch(parsed.query || "", parsed.sort || "relevance", signal),
    tagged: () => {
      if (!parsed.tag) throw new Error("Missing Stack Overflow tag");
      return handleTagged(parsed.tag, parsed.sort || "votes", signal);
    },
    questions: () => handleQuestions(signal),
    users: () => {
      throw new Error("Stack Overflow users listing is not supported");
    },
    user: () => {
      throw new Error("Stack Overflow user profiles are not supported");
    },
  };
  return handlers[parsed.kind]();
}
export const stackoverflowParser = defineParser(
  "Stack Overflow",
  (url) => /^https?:\/\/(?:www\.)?stackoverflow\.com\//i.test(url),
  parseStackOverflowUrl,
  dispatchSo,
);
