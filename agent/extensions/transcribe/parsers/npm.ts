import {
  createRetryFetch,
  createVersionedPackageParser,
  defineParser,
  requireVersion,
  type VersionedPackagePath,
} from "../lib/parser-utils";
import { formatDate, countLabel } from "../lib/formatters";

interface NpmPath {
  kind: "package" | "version" | "latest" | "registry";
  name: string;
  version?: string;
}

function parseNpmUrl(url: string): NpmPath | null {
  const registryMatch = url.match(
    /^https?:\/\/registry\.npmjs\.org\/([^/?]+)/i,
  );
  if (registryMatch) {
    return { kind: "registry", name: registryMatch[1] };
  }
  return createVersionedPackageParser(
    /^https?:\/\/www\.npmjs\.com\/package\/([^/?]+)/i,
  )(url);
}

const fetchNpm = createRetryFetch({ apiName: "npm" });

interface NpmPackageInfo {
  name: string;
  description?: string;
  version?: string;
  license?: string | Record<string, unknown>;
  author?: string | Record<string, unknown>;
  homepage?: string;
  repository?: string | Record<string, unknown>;
  keywords?: string[];
  maintainers?: Array<{ name: string }>;
  date?: string;
  versions?: Record<string, Record<string, unknown>>;
  "dist-tags"?: { latest?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
  browser?: string;
  bin?: string | Record<string, string>;
}

function extractLicenseString(
  license: string | Record<string, unknown> | undefined,
): string | null {
  if (!license) return null;
  if (typeof license === "string") return license;
  const lic = license.type;
  if (typeof lic === "string") return lic;
  return null;
}

function extractAuthorName(
  author: string | Record<string, unknown> | undefined,
): string | null {
  if (typeof author === "string") return author;
  const name = (author as Record<string, unknown>).name;
  if (typeof name === "string") return name;
  return null;
}

function formatNpmPackageHeader(data: NpmPackageInfo): string[] {
  const parts: string[] = [`# ${data.name}`];
  if (data.description) parts.push(data.description);

  const latest = data["dist-tags"]?.latest || data.version || "unknown";
  parts.push(`version: ${latest}`);

  const license = extractLicenseString(data.license);
  if (license) parts.push(`license: ${license}`);

  const author = extractAuthorName(data.author);
  if (author) parts.push(`author: ${author}`);

  return parts;
}

function formatNpmKeywords(keywords: string[] | undefined): string[] {
  if (!keywords?.length) return [];
  return ["", `**Keywords:** ${keywords.join(", ")}`];
}

function formatNpmDependencies(
  dependencies: Record<string, string> | undefined,
): string[] {
  if (!dependencies || !Object.keys(dependencies).length) return [];
  const deps = Object.entries(dependencies);
  const lines: string[] = ["", "**Dependencies:**"];
  for (const [dep, ver] of deps) {
    lines.push(`- ${dep}: ${ver}`);
  }
  return lines;
}

function formatNpmPublishedDate(date: string | undefined): string[] {
  if (!date) return [];
  return ["", `published: ${formatDate(date)}`];
}

function formatNpmLinks(
  homepage: string | undefined,
  repository: string | Record<string, unknown> | undefined,
): string[] {
  if (homepage) return [`\n[${homepage}](${homepage})`];
  if (repository && typeof repository === "string") {
    return [`\n[${repository}](https://github.com/${repository})`];
  }
  return [];
}

async function handlePackage(
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchNpm<NpmPackageInfo>(
    `https://registry.npmjs.org/${name}`,
    signal,
  );

  if (!data.name) throw new Error(`Package ${name} not found on npm`);

  const parts: string[] = [
    ...formatNpmPackageHeader(data),
    ...formatNpmKeywords(data.keywords),
    ...formatNpmDependencies(data.dependencies),
    ...formatNpmPublishedDate(data.date),
    ...formatNpmLinks(data.homepage, data.repository),
  ];

  parts.push("", `[View on npm](https://www.npmjs.com/package/${name})`);

  return parts.join("\n");
}

function formatBinEntries(
  bin: string | Record<string, string> | undefined,
): string[] {
  if (typeof bin === "string") return [`- bin: ${bin}`];
  if (bin && typeof bin === "object" && !Array.isArray(bin)) {
    const entries: string[] = [];
    for (const [name, path] of Object.entries(bin)) {
      entries.push(`- ${name}: ${path}`);
    }
    return entries;
  }
  return [];
}

function formatEntryPoints(data: NpmPackageInfo): string[] {
  const hasEntries = data.main || data.browser || data.bin;
  if (!hasEntries) return [];

  const lines: string[] = ["", "**Entry points:**"];
  if (data.main) lines.push(`- main: ${data.main}`);
  if (data.browser) lines.push(`- browser: ${data.browser}`);
  lines.push(...formatBinEntries(data.bin));
  return lines;
}

function formatSortedDependencies(
  dependencies: Record<string, string> | undefined,
): string[] {
  if (!dependencies || !Object.keys(dependencies).length) return [];
  const sortedDeps = Object.entries(dependencies).sort();
  const lines: string[] = ["", "**Dependencies:**"];
  for (const [dep, ver] of sortedDeps) {
    lines.push(`- ${dep}: ${ver}`);
  }
  return lines;
}

function formatScripts(scripts: Record<string, string> | undefined): string[] {
  if (!scripts || !Object.keys(scripts).length) return [];
  const lines: string[] = ["", "**Scripts:**"];
  for (const [script, cmd] of Object.entries(scripts)) {
    lines.push(`- ${script}: \`${cmd}\``);
  }
  return lines;
}

async function handleVersion(
  name: string,
  version: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchNpm<NpmPackageInfo>(
    `https://registry.npmjs.org/${name}/${version}`,
    signal,
  );

  if (!data.name) throw new Error(`Version ${version} not found for ${name}`);

  const parts: string[] = [`# ${name}@${version}`];
  if (data.description) parts.push(data.description);

  const license = extractLicenseString(data.license);
  if (license) parts.push(`license: ${license}`);

  const lines: string[] = [
    ...formatEntryPoints(data),
    ...formatSortedDependencies(data.dependencies),
    ...formatScripts(data.scripts),
    ...formatNpmPublishedDate(data.date),
  ];

  parts.push(...lines);
  parts.push(
    "",
    `[View on npm](https://www.npmjs.com/package/${name}/v/${version})`,
  );

  return parts.join("\n");
}

async function handleVersions(
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchNpm<NpmPackageInfo>(
    `https://registry.npmjs.org/${name}`,
    signal,
  );

  if (!data.name) throw new Error(`Package ${name} not found on npm`);

  const versions = Object.keys(data.versions ?? {});
  const distTags = data["dist-tags"] ?? {};
  const parts: string[] = [
    `# ${name}`,
    `**${countLabel(versions.length, "version")}**`,
  ];

  if (Object.keys(distTags).length > 0) {
    parts.push("", "**Dist tags:**");
    for (const [tag, version] of Object.entries(distTags)) {
      parts.push(`- ${tag}: ${version}`);
    }
  }

  parts.push("", "**All versions:**");
  for (const v of versions) {
    parts.push(`- ${v}`);
  }

  parts.push(
    "",
    `[View on npm](https://www.npmjs.com/package/${name}/v/${versions[versions.length - 1]})`,
  );

  return parts.join("\n");
}

function dispatchNpm(parsed: NpmPath, signal?: AbortSignal): Promise<string> {
  const handlers: Record<NpmPath["kind"], () => Promise<string>> = {
    package: () => handlePackage(parsed.name, signal),
    version: () =>
      handleVersion(
        parsed.name,
        requireVersion(parsed as VersionedPackagePath),
        signal,
      ),
    latest: () => handlePackage(parsed.name, signal),
    registry: () => handleVersions(parsed.name, signal),
  };
  return handlers[parsed.kind]();
}

export const npmParser = defineParser(
  "npm",
  (url) => /^https?:\/\/(www\.)?npmjs\.com\//i.test(url),
  parseNpmUrl,
  dispatchNpm,
);
