import { MAX_REDIRECTS } from "./constants";

function handleRedirect(response: Response, currentUrl: string): string | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location, currentUrl).toString();
}

export async function fetchWithRedirect(
  url: string,
  init: RequestInit = {},
): Promise<{
  response: Response;
  redirected: boolean;
  redirectChain: string[];
}> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  let redirected = false;

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const response = await fetch(currentUrl, init);
    const nextUrl = handleRedirect(response, currentUrl);
    if (nextUrl) {
      redirectChain.push(currentUrl);
      currentUrl = nextUrl;
      redirected = true;
      init.headers = response.headers;
      continue;
    }
    return { response, redirected, redirectChain };
  }

  throw new Error(
    `DuckDuckGo request redirected too many times (${MAX_REDIRECTS})`,
  );
}
