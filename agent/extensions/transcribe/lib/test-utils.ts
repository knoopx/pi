import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface FixtureEntry {
  pattern: string;
  file: string;
}

const FIXTURES: FixtureEntry[] = [
  {
    pattern: "export.arxiv.org/api/query",
    file: "../parsers/__fixtures__/arxiv-api-2310.06825.xml",
  },
  {
    pattern: "en.wikipedia.org/w/api.php?action=query&prop=revisions",
    file: "../parsers/__fixtures__/wikipedia-ai-wikitext.txt",
  },
  {
    pattern: "en.wikipedia.org/api/rest_v1/page/summary/",
    file: "../parsers/__fixtures__/wikipedia-summary-ai.json",
  },
  {
    pattern: "huggingface.co/api/models/openai/whisper-large-v3",
    file: "../parsers/__fixtures__/huggingface-model-whisper.json",
  },
  {
    pattern: "huggingface.co/openai/whisper-large-v3/resolve/main/README.md",
    file: "../parsers/__fixtures__/huggingface-readme-whisper.md",
  },
  {
    pattern: "pypi.org/pypi/requests/json",
    file: "../parsers/__fixtures__/pypi-requests.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/hot.json",
    file: "../parsers/__fixtures__/reddit-typescript-hot.json",
  },
  {
    pattern: "www.reddit.com/r/programming/hot.json",
    file: "../parsers/__fixtures__/reddit-r-programming-hot.json",
  },
  {
    pattern: "www.reddit.com/r/javascript/top.json",
    file: "../parsers/__fixtures__/reddit-r-javascript-top-week.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/comments/1t0d9jn",
    file: "../parsers/__fixtures__/reddit-thread-1t0d9jn.json",
  },
  {
    pattern: "www.reddit.com/r/typescript/comments/1t1p1ex",
    file: "../parsers/__fixtures__/reddit-thread-1t1p1ex.json",
  },
  {
    pattern: "www.reddit.com/user/spez/submitted.json",
    file: "../parsers/__fixtures__/reddit-user-spez-submitted.json",
  },
  {
    pattern: "api.stackexchange.com/2.3/questions/79935417/answers",
    file: "../parsers/__fixtures__/stackoverflow-answers-79935417.json",
  },
  {
    pattern: "api.stackexchange.com/2.3/questions/79935417?",
    file: "../parsers/__fixtures__/stackoverflow-questions-79935417.json",
  },
  {
    pattern: "registry.npmjs.org/vitest",
    file: "../parsers/__fixtures__/npm-vitest.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/topstories.json",
    file: "../parsers/__fixtures__/hackernews-topstories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/newstories.json",
    file: "../parsers/__fixtures__/hn-newstories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/best.json",
    file: "../parsers/__fixtures__/hn-beststories.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/39427851.json",
    file: "../parsers/__fixtures__/hn-item-39427851-comment.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/38935672.json",
    file: "../parsers/__fixtures__/hn-item-38935672-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/42758536.json",
    file: "../parsers/__fixtures__/hn-item-42758536-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/item/42761753.json",
    file: "../parsers/__fixtures__/hn-item-42761753-story.json",
  },
  {
    pattern: "hacker-news.firebaseio.com/v0/user/jasonrudolph.json",
    file: "../parsers/__fixtures__/hn-user-jasonrudolph.json",
  },
];

const fixtureMap = new Map<string, string>();
for (const f of FIXTURES) {
  const content = readFileSync(join(__dirname, f.file), "utf-8");
  fixtureMap.set(f.pattern, content);
}

// Load the default item fixture for any unmatched HN item URLs
const defaultItemContent = readFileSync(
  join(__dirname, "../parsers/__fixtures__/hackernews-item-default.json"),
  "utf-8",
);

const FIXED_NOW = new Date("2025-01-15T12:00:00Z").getTime();

export function mockFetchWithFixtures(): void {
  beforeAll(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });
  afterAll(() => {
    vi.useRealTimers();
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
    // Return default HN item for any unmatched item URLs
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
