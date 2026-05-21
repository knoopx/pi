import { createBashTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createExec } from "../../shared/process/spawn-factory";

type ReplDefinition = {
  name: string;
  label: string;
  description: string;
  program: string;
  args: (input: string) => string[];
};

const repls: ReplDefinition[] = [
  {
    name: "bun-repl",
    label: "bun-repl",
    description: `Evaluate JavaScript or TypeScript code inline.`,
    program: "bun",
    args: (c) => ["-e", c],
  },
  {
    name: "nu-repl",
    label: "nu-repl",
    description: `Evaluate nushell code inline.`,
    program: "nu",
    args: (c) => ["-c", c],
  },
  {
    name: "duckdb-repl",
    label: "duckdb-repl",
    description: `Evaluate DuckDB SQL code inline.`,
    program: "duckdb",
    args: (q) => [":memory:", "-no-init", "-c", q],
  },
  {
    name: "python-repl",
    label: "python-repl",
    description: `Evaluate Python code inline.`,
    program: "python3",
    args: (c) => ["-c", c],
  },
];

export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();

  for (const repl of repls) {
    const operations = {
      operations: { exec: createExec(repl.program, repl.args) },
    };

    const tool = createBashTool(cwd, operations);

    pi.registerTool({
      ...tool,
      name: repl.name,
      label: repl.label,
      description: repl.description,
      execute: async (id, params, signal, onUpdate) => {
        return tool.execute(id, params, signal, onUpdate);
      },
    });
  }
}
