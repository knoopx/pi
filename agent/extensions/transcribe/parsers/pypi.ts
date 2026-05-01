import {
  createRetryFetch,
  createVersionedPackageParser,
  defineParser,
  requireVersion,
  type VersionedPackagePath,
} from "../lib/parser-utils";

interface PypiPath extends VersionedPackagePath {
  kind: "package" | "version";
}

const parsePypiUrl = createVersionedPackageParser(
  /^https?:\/\/pypi\.org\/project\/([^/?]+)/i,
);

const fetchPypi = createRetryFetch({ apiName: "PyPI" });

interface PypiPackageInfo {
  info: {
    name: string;
    summary?: string;
    version?: string;
    license?: string | Record<string, unknown>;
    author?: string;
    author_email?: string;
    maintainer?: string;
    maintainer_email?: string;
    home_page?: string;
    project_url?: string;
    project_urls?: Record<string, string>;
    keywords?: string;
    classifiers?: string[];
    requires_python?: string;
    license_expression?: string;
    downloads?: { period_30d?: { fills?: number } };
  };
  last_serial?: number;
  urls?: Array<{
    packagetype: string;
    filename: string;
    size?: number;
    upload_time?: string;
    md5_digest?: string;
    sha256_digest?: string;
    url: string;
  }>;
}

function extractLicense(info: PypiPackageInfo["info"]): string | null {
  if (info.license_expression) return info.license_expression;
  if (typeof info.license === "string" && info.license.trim()) {
    return info.license.trim();
  }
  if (typeof info.license === "object" && info.license !== null) {
    const licenseObj = info.license as {
      license_expression?: string;
      name?: string;
    };
    const val = licenseObj.license_expression ?? licenseObj.name;
    if (typeof val === "string") return val;
  }
  return null;
}

function formatPypiHeader(info: PypiPackageInfo["info"]): string[] {
  const parts: string[] = [`# ${info.name}`];
  if (info.summary) parts.push(info.summary);
  parts.push(`version: ${info.version || "unknown"}`);

  const license = extractLicense(info);
  if (license) parts.push(`license: ${license}`);
  if (info.author) parts.push(`author: ${info.author}`);
  if (info.maintainer) parts.push(`maintainer: ${info.maintainer}`);
  if (info.requires_python) parts.push(`python: >=${info.requires_python}`);

  return parts;
}

function formatPypiKeywords(keywords: string): string[] {
  const tags = keywords.split(",").map((k) => k.trim());
  if (tags.length === 0) return [];
  return ["", `**Keywords:** ${tags.join(", ")}`];
}

function groupClassifiers(classifiers: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const c of classifiers) {
    const parts2 = c.split(" :: ");
    if (parts2.length >= 2) {
      const key = parts2[0];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(parts2.slice(1).join(" :: "));
    } else {
      if (!grouped["Other"]) grouped["Other"] = [];
      grouped["Other"].push(c);
    }
  }
  return grouped;
}

function formatPypiClassifiers(classifiers: string[] | undefined): string[] {
  if (!classifiers?.length) return [];
  const grouped = groupClassifiers(classifiers);
  const lines: string[] = [];
  for (const [category, values] of Object.entries(grouped)) {
    lines.push("", `**${category}:**`);
    for (const v of values) {
      lines.push(`- ${v}`);
    }
  }
  return lines;
}

function collectPypiLinks(
  info: PypiPackageInfo["info"],
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  if (info.home_page) links.push({ label: "Homepage", url: info.home_page });
  if (info.project_urls) {
    for (const [label, url] of Object.entries(info.project_urls)) {
      if (!links.find((l) => l.url === url)) {
        links.push({ label, url });
      }
    }
  }
  return links;
}

function formatPypiLinks(
  links: Array<{ label: string; url: string }>,
): string[] {
  if (links.length === 0) return [];
  const lines: string[] = [""];
  for (const link of links) {
    lines.push(`[${link.label}](${link.url})`);
  }
  return lines;
}

function formatPypiDownloads(info: PypiPackageInfo["info"]): string[] {
  const fills = info.downloads?.period_30d?.fills;
  if (!fills) return [];
  return [
    "",
    `downloads (last 30 days): ${Math.round(fills * 1e6).toLocaleString()}`,
  ];
}

function formatPypiWheels(urls: PypiPackageInfo["urls"] | undefined): string[] {
  if (!urls?.length) return [];
  const dists = urls.filter((u) => u.packagetype === "bdist_wheel");
  if (dists.length === 0) return [];

  const lines: string[] = ["", `**Releases (${dists.length} wheel(s)):**`];
  for (const u of dists.slice(0, 10)) {
    const size = u.size ? `(${(u.size / 1024).toFixed(1)} KB)` : "";
    lines.push(`- [${u.filename}](${u.url}) ${size}`);
  }
  if (dists.length > 10) {
    lines.push(`- ... and ${dists.length - 10} more`);
  }
  return lines;
}

async function handlePackage(
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchPypi<PypiPackageInfo>(
    `https://pypi.org/pypi/${name}/json`,
    signal,
  );

  if (!data.info.name) throw new Error(`Package ${name} not found on PyPI`);

  const info = data.info;
  const parts: string[] = [
    ...formatPypiHeader(info),
    ...(info.keywords ? formatPypiKeywords(info.keywords) : []),
    ...formatPypiClassifiers(info.classifiers),
    ...formatPypiLinks(collectPypiLinks(info)),
    ...formatPypiDownloads(info),
    ...formatPypiWheels(data.urls),
  ];

  parts.push("", `[View on PyPI](https://pypi.org/project/${name}/)`);

  return parts.join("\n");
}

function formatVersionFiles(
  urls: Array<{ packagetype: string; filename: string }>,
): string[] {
  if (urls.length === 0) return [];
  const lines: string[] = ["", "**Available files:**"];
  for (const u of urls.slice(0, 15)) {
    lines.push(`- ${u.filename}`);
  }
  if (urls.length > 15) {
    lines.push(`- ... and ${urls.length - 15} more`);
  }
  return lines;
}

function formatVersionWheels(
  urls: PypiPackageInfo["urls"] | undefined,
): string[] {
  if (!urls?.length) return [];
  const wheels = urls.filter((u) => u.packagetype === "bdist_wheel");
  if (wheels.length === 0) return [];

  const lines: string[] = ["", `**Download (${wheels.length} wheel(s)):**`];
  for (const u of wheels.slice(0, 5)) {
    const size = u.size ? ` (${(u.size / 1024).toFixed(1)} KB)` : "";
    lines.push(`- [${u.filename}](${u.url})${size}`);
  }
  return lines;
}

async function handleVersion(
  name: string,
  version: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchPypi<PypiPackageInfo>(
    `https://pypi.org/pypi/${name}/${version}/json`,
    signal,
  );

  if (!data.info.name)
    throw new Error(`Version ${version} not found for ${name}`);

  const info = data.info;
  const parts: string[] = [`# ${name}@${version}`];
  if (info.summary) parts.push(info.summary);

  const license = extractLicense(info);
  if (license) parts.push(`license: ${license}`);
  if (info.author) parts.push(`author: ${info.author}`);
  if (info.requires_python) parts.push(`python: >=${info.requires_python}`);

  const urls = data.urls || [];
  const lines: string[] = [
    ...formatVersionFiles(urls),
    ...formatVersionWheels(urls),
  ];

  parts.push(...lines);
  parts.push(
    "",
    `[View on PyPI](https://pypi.org/project/${name}/${version}/)`,
  );

  return parts.join("\n");
}

function dispatchPypi(parsed: PypiPath, signal?: AbortSignal): Promise<string> {
  const handlers: Record<PypiPath["kind"], () => Promise<string>> = {
    package: () => handlePackage(parsed.name, signal),
    version: () => handleVersion(parsed.name, requireVersion(parsed), signal),
  };
  return handlers[parsed.kind]();
}

export const pypiParser = defineParser(
  "PyPI",
  (url) => /^https?:\/\/pypi\.org\//i.test(url),
  parsePypiUrl,
  dispatchPypi,
);
