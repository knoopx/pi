export const DDG_HOST = "duckduckgo.com";
export const MAX_REDIRECTS = 3;

export const DDG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  Connection: "keep-alive",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua":
    '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "upgrade-insecure-requests": "1",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  referer: "https://duckduckgo.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export const DDG_DATA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  Connection: "keep-alive",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua":
    '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-dest": "script",
  referer: "https://duckduckgo.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};
