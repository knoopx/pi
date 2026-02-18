import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ArgsSection, FileCommand } from "./command-palette-types";
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";

interface CommandFrontmatter {
  description?: string;
  args?: ArgsSection;
}

/** Parse frontmatter and content from markdown */
export function parseMarkdown(content: string): {
  frontmatter: CommandFrontmatter;
  body: string;
} {
  const lines = content.split("\n");

  if (lines[0] !== "---") {
    return { frontmatter: {}, body: content };
  }

  const endMarker = lines.indexOf("---", 1);
  if (endMarker === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterYaml = lines.slice(1, endMarker).join("\n");
  const body = lines.slice(endMarker + 1).join("\n");

  try {
    const frontmatter = yaml.load(frontmatterYaml) as CommandFrontmatter;
    return { frontmatter: frontmatter || {}, body };
  } catch {
    return { frontmatter: {}, body };
  }
}

/** Load commands from ~/.pi/agent/commands/*.md */
export function loadFileCommands(_pi: ExtensionAPI): FileCommand[] {
  const commandsDir = path.join(
    process.env.HOME ?? "",
    ".pi",
    "agent",
    "commands",
  );

  try {
    if (!fs.existsSync(commandsDir)) {
      return [];
    }

    const files = fs.readdirSync(commandsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const commands: FileCommand[] = [];

    for (const file of mdFiles) {
      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseMarkdown(content);

      const name = file.replace(".md", "");
      const description =
        frontmatter.description ||
        body.split("\n").find((l) => l.trim() && !l.trim().startsWith("#")) ||
        "";

      // Check if template contains shell commands
      const hasShellCommands = /!\{[^}]+\}/.test(body);

      commands.push({
        name,
        description,
        template: body,
        hasShellCommands,
        filePath,
        args: frontmatter.args,
      });
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to load file commands:", error);
    return [];
  }
}

/** Evaluate !{...} shell commands in template */
export async function evaluateShellCommands(
  pi: ExtensionAPI,
  template: string,
  cwd: string,
): Promise<string> {
  const shellCommandRegex = /!\{([^}]+)\}/g;
  let result = template;
  let match: RegExpExecArray | null;

  while ((match = shellCommandRegex.exec(template)) !== null) {
    const fullMatch = match[0];
    const command = match[1].trim();

    try {
      // Use sh -c to support pipes and redirects
      const execResult = await pi.exec("sh", ["-c", command], {
        cwd,
        timeout: 10000,
      });

      // Use stdout, trim trailing whitespace
      const output = execResult.stdout.trim();
      result = result.replace(fullMatch, output);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result = result.replace(fullMatch, `[Error: ${msg}]`);
    }
  }

  return result;
}
