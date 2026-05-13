import { defineParser } from "../../lib/parser-utils";
import { parseHnUrl } from "./url-parsing";
import { dispatchHN } from "./handlers";

export const hackernewsParser = defineParser(
  "Hacker News",
  (url) =>
    /^https?:\/\/(news\.ycombinator\.com|hacker-news\.firebaseio\.com)\//i.test(
      url,
    ),
  parseHnUrl,
  dispatchHN,
);
