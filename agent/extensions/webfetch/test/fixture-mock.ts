import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface FixtureEntry {
  pattern: string;
  file: string;
}

const FIXTURES: FixtureEntry[] = [
  {
    pattern: "export.arxiv.org/api/query",
    file: "../parsers/fixtures/arxiv-api-2310.06825.xml",
  },
  {
    pattern: "en.wikipedia.org/w/api.php?action=query&prop=revisions",
    file: "../parsers/fixtures/wikipedia-ai-wikitext.txt",
  },
  {
    pattern: "en.wikipedia.org/api/rest_v1/page/summary/",
    file: "../parsers/fixtures/wikipedia-summary-ai.json",
  },
  {
    pattern: "huggingface.co/api/models/openai/whisper-large-v3",
    file: "../parsers/fixtures/huggingface-model-whisper.json",
  },
  {
    pattern: "huggingface.co/openai/whisper-large-v3/resolve/main/README.md",
    file: "../parsers/fixtures/huggingface-readme-whisper.md",
  },
  {
    pattern: "pypi.org/pypi/requests/json",
    file: "../parsers/fixtures/pypi-requests.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/hot.json",
    file: "../parsers/fixtures/reddit-typescript-hot.json",
  },
  {
    pattern: "www.reddit.com/r/programming/hot.json",
    file: "../parsers/fixtures/reddit-r-programming-hot.json",
  },
  {
    pattern: "www.reddit.com/r/javascript/top.json",
    file: "../parsers/fixtures/reddit-r-javascript-top-week.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/comments/1t0d9jn",
    file: "../parsers/fixtures/reddit-thread-1t0d9jn.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/comments/1t1p1ex",
    file: "../parsers/fixtures/reddit-thread-1t1p1ex.json",
  },
  {
    pattern: "www.reddit.com/comments/1t0d9jn",
    file: "../parsers/fixtures/reddit-thread-1t0d9jn.json",
  },
  {
    pattern: "www.reddit.com/comments/1t1p1ex",
    file: "../parsers/fixtures/reddit-thread-1t1p1ex.json",
  },
  {
    pattern: "www.reddit.com/user/spez/submitted.json",
    file: "../parsers/fixtures/reddit-user-spez-submitted.json",
  },
  {
    pattern: "api.stackexchange.com/2.3/questions/79935417/answers",
    file: "../parsers/fixtures/stackoverflow-answers-79935417.json",
  },
  {
    pattern: "api.stackexchange.com/2.3/questions/79935417?",
    file: "../parsers/fixtures/stackoverflow-questions-79935417.json",
  },
  {
    pattern: "registry.npmjs.org/vitest",
    file: "../parsers/fixtures/npm-vitest.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/topstories.json",
    file: "../parsers/fixtures/hackernews-topstories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/newstories.json",
    file: "../parsers/fixtures/hn-newstories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/best.json",
    file: "../parsers/fixtures/hn-beststories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/39427851.json",
    file: "../parsers/fixtures/hn-item-39427851-comment.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/38935672.json",
    file: "../parsers/fixtures/hn-item-38935672-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/42758536.json",
    file: "../parsers/fixtures/hn-item-42758536-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/42761753.json",
    file: "../parsers/fixtures/hn-item-42761753-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/user/jasonrudolph.json",
    file: "../parsers/fixtures/hn-user-jasonrudolph.json",
  },
];

const fixtureMap = new Map<string, string>();
for (const f of FIXTURES) {
  const content = readFileSync(join(__dirname, f.file), "utf-8");
  fixtureMap.set(f.pattern, content);
}

// Load the default item fixture for any unmatched HN item URLs
const defaultItemContent = readFileSync(
  join(__dirname, "../parsers/fixtures/hackernews-item-default.json"),
  "utf-8",
);

const FIXED_NOW = new Date("2026-05-03T11:14:00Z").getTime();

export function mockFetchWithFixtures(): void {
  vi.useFakeTimers({ now: FIXED_NOW });
  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = String(input);
    }
    for (const [pattern, content] of fixtureMap) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          text: async () => content,
          json: async () => JSON.parse(content),
        } as Response;
      }
    }
    if (url.includes("hacker-news.firebaseio.com/v0/item/")) {
      return {
        ok: true,
        status: 200,
        text: async () => defaultItemContent,
        json: async () => JSON.parse(defaultItemContent),
      } as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
}
