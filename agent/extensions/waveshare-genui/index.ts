import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const toolDescription = `Render openui-lang to the 720×720 display.

## openui-lang syntax
Each statement: \`identifier = Expression\`. \`root = Canvas(...)\` is the entry point.
Expressions: strings \`"..."\`, numbers, booleans, arrays \`[...]\`, objects \`{...}\`, component calls \`TypeName(arg1, arg2, ...)\`.
Arguments are positional. Optional arguments are omitted from the end.
Every variable must be reachable from root.

## Priority levels
- high: notifications, alerts. Preempts whatever is on screen immediately. Holds 5s.
- normal (default): contextual info, status updates. 3s minimum display time.
- low: idle screens, background info. 1s hold, yields to anything higher.

## Components

Layout: Canvas(children[]), Header(icon, title, subtitle?), Content(children[], gap?), Stack(children[], direction?, gap?, align?, justify?, wrap?), Card(children[], variant?), Separator(), Spacer()

Content: Text(content, size?, weight?, color?, align?), Icon(glyph, color?, size?), Badge(label, color?), CodeBlock(language, codeString), Alert(title, message?, icon?, color?), EmptyState(title, message?, icon?, color?), Timestamp()

Data Display: Table(columns, rows), Col(label, type?, align?), List(items), ListItem(text, secondary?, icon?, value?), KeyValue(label, value, secondary?, color?), Stat(label, value, unit?, helper?, color?), Steps(items), StepsItem(title, details?), TagBlock(tags), Tag(text, icon?, color?)

Data Visualization: Gauge(label, value, max?, unit?, size?, color?), ProgressBar(label, value, max?, display?, color?), Sparkline(values[], color?, height?), StatusDot(up)

Media: Image(src, width?, height?, fit?, borderRadius?), QRCode(data, size?, color?)

## Icons

Use named icons everywhere: Header("check", ...), Alert(..., "warning"), ListItem(..., "cart").
For custom icon color or size, use Icon element: Header(Icon("warning", "red"), ...).

Available names: check, warning, error, info, question, home, search, settings, menu, list, grid, edit, sync, refresh, clock, calendar, mail, bell, lock, globe, link, file, folder, image, music, video, camera, lightbulb, bolt, tag, bookmark, star, heart, user, users, cart, database, server, desktop, cloud, wifi, rss, up, down, left, right, location, chart, bars, table, steps, play, pause, stop, download, upload, trash, plus, minus, toggle, code, bug, git, github, terminal, cpu, memory, disk, thermometer, train, rocket, docker, nix, react, rust, python, circle, dot, shield, flag, trophy, monitor, qrcode, palette.

## Component notes
- Canvas is always root. Header + Content is the standard page pattern.
- Stack(direction="row") for horizontal layout, Stack(direction="column") for vertical layout.
- Stack(direction="row", wrap=true) for grid layouts such as 2×2 gauges.
- Stack supports align="baseline" for text-aligned rows and justify="evenly" for equal spacing.
- Card(variant="card") is elevated, "sunk" is recessed, "clear" is transparent.
- Icon uses named icons. Icon("check") renders the icon, Icon("check", "green") adds color, Icon("check", "green", 40) adds size.
- Anywhere an icon is accepted, pass a name string or an Icon element.
- Timestamp auto-displays current time. Place it as the last Canvas child.
- Table: define Col refs first, then pass rows as a 2D array.
- Col(type="number") auto-aligns right. align overrides the default.
- List: define ListItem refs, then pass them as the items array.
- Display fits about 12 table rows or 8 list items.
- Gauge is a circular arc. Stack 2–4 in a row+wrap Stack for dashboard grids.
- ProgressBar is a full-width horizontal bar with a label.
- Sparkline is a mini line chart and takes an array of numbers.
- QRCode renders a QR code SVG from a string. size defaults to 400.
- Image displays a PNG, JPG, or WebP from a local file path or data URI. Local paths are base64-embedded automatically.
- All components share the same semantic color options: default, muted, accent, green, red, yellow, cyan, orange, purple.

## Values
Colors: default, muted, accent, green, red, yellow, cyan, orange, purple (no hex)
Font sizes: xs(20), sm(22), md(26), lg(30), xl(36), 2xl(44), 3xl(80)
Gap: none(0), xs(4), sm(8), md(16), lg(24), xl(32)
Font: Inter (text), Nerd Font (icons)

## Layout patterns

Example — Notification:
\`\`\`
root = Canvas([header, content, ts])
header = Header("check", "Build Complete")
content = Content([msg])
msg = Text("All 42 tests passed. Deployed to staging.", "xl", "normal", "muted")
ts = Timestamp()
\`\`\`

Example — List with icons:
\`\`\`
root = Canvas([header, content, ts])
header = Header("list", "To Do")
content = Content([list])
list = List(items)
items = [ListItem("Buy groceries", "Milk, bread, eggs", "cart"), ListItem("Review PR #284", "Auth refactor", "git", "3"), ListItem("Deploy staging", "v1.2.3 RC", "bolt")]
ts = Timestamp()
\`\`\`

Example — Gauge dashboard:
\`\`\`
root = Canvas([grid, ts])
grid = Stack([g1, g2, g3, g4], "row", "md", "center", "center", true)
g1 = Gauge("CPU", 73, 100, "%")
g2 = Gauge("RAM", 4.2, 8, "GB")
g3 = Gauge("Disk", 120, 500, "GB")
g4 = Gauge("Temp", 62, 100, "°C")
ts = Timestamp()
\`\`\`

Example — Cards with sparklines:
\`\`\`
root = Canvas([header, content, ts])
header = Header("chart", "Market")
content = Content([c1, c2], "sm")
c1 = Card([row1, spark1])
row1 = Stack([sym1, price1], "row", "sm", "center", "between")
sym1 = Text("AAPL", "md", "bold", "muted")
price1 = Text("$178.52", "lg", "bold")
spark1 = Sparkline([170, 172, 175, 173, 178], "green")
c2 = Card([row2, spark2])
row2 = Stack([sym2, price2], "row", "sm", "center", "between")
sym2 = Text("MSFT", "md", "bold", "muted")
price2 = Text("$415.80", "lg", "bold")
spark2 = Sparkline([420, 418, 415, 416, 415], "red")
ts = Timestamp()
\`\`\`

Example — Status monitor:
\`\`\`
root = Canvas([header, content, ts])
header = Header("monitor", "Monitor", "5/6 up")
content = Content([s1, sep1, s2, sep2, s3])
s1 = Stack([StatusDot(true), Text("API Server", "md", "bold"), Badge("142ms", "green")], "row", "md", "center")
sep1 = Separator()
s2 = Stack([StatusDot(true), Text("Database", "md", "bold"), Badge("89ms", "green")], "row", "md", "center")
sep2 = Separator()
s3 = Stack([StatusDot(false), Text("CDN", "md", "bold"), Badge("DOWN", "red")], "row", "md", "center")
ts = Timestamp()
\`\`\`

Example — Table:
\`\`\`
root = Canvas([header, content, ts])
header = Header("table", "Team Roster")
content = Content([tbl])
tbl = Table(cols, rows)
cols = [Col("Name"), Col("Role"), Col("Status")]
rows = [["Alice", "Backend", "Active"], ["Bob", "Frontend", "Active"], ["Carol", "DevOps", "On Leave"]]
ts = Timestamp()
\`\`\`

Example — KPI grid:
\`\`\`
root = Canvas([header, content, ts])
header = Header("bars", "Overview")
content = Content([grid], "md")
grid = Stack([stat1, stat2, stat3, stat4], "row", "md", "stretch", "start", true)
stat1 = Stat("Revenue", "$24.8k", null, "+12% vs last week", "green")
stat2 = Stat("Orders", "182", null, "14 pending", "accent")
stat3 = Stat("Latency", "142", "ms", "p95", "yellow")
stat4 = Stat("Errors", "3", null, "last hour", "red")
ts = Timestamp()
\`\`\`

Example — Empty state with alert:
\`\`\`
root = Canvas([header, content, ts])
header = Header("info", "Deployments")
content = Content([alert, empty], "lg")
alert = Alert("Maintenance Window", "Production deploys are paused until 22:00.", "warning", "yellow")
empty = EmptyState("No pending deploys", "Everything is shipped. Check back after the freeze.", "check", "green")
ts = Timestamp()
\`\`\`

Example — Steps process:
\`\`\`
root = Canvas([header, content, ts])
header = Header("steps", "Setup Guide")
content = Content([steps])
steps = Steps([StepsItem("Install dependencies", "Run bun install in the project root."), StepsItem("Configure environment", "Copy .env.example to .env and fill in values."), StepsItem("Start development", "Run bun run dev to launch the dev server.")])
ts = Timestamp()
\`\`\`

Example — Code block:
\`\`\`
root = Canvas([header, content, ts])
header = Header("code", "Snippet")
content = Content([code])
code = CodeBlock("typescript", "const greeting = (name: string) =>\\n  \`Hello, \${name}!\`;\\n\\nconsole.log(greeting(\"world\"));")
ts = Timestamp()
\`\`\`

Example — Tag cloud:
\`\`\`
root = Canvas([header, content, ts])
header = Header("tag", "Topics")
content = Content([tags])
tags = TagBlock([Tag("TypeScript", "code", "accent"), Tag("React", "react", "cyan"), Tag("Rust", "rust", "orange"), Tag("NixOS", "nix", "purple"), Tag("Docker", "docker", "cyan")])
ts = Timestamp()
\`\`\`

Example — Icon with custom color:
\`\`\`
root = Canvas([header, content, ts])
header = Header(Icon("warning", "red"), "Alerts")
content = Content([row])
row = Stack([Icon("check", "green", 40), Text("All systems operational", "lg")], "row", "md", "center")
ts = Timestamp()
\`\`\`

## Hoisting & Streaming

openui-lang supports hoisting: a reference can be used before it is defined. The parser resolves all references after the full input is parsed.

For best streaming order:
1. \`root = Canvas(...)\` first so the shell appears immediately.
2. Component definitions next.
3. Leaf data last.

## Constraints
720×720 px. All text content must be strings, not numbers. Semantic colors only. Do not invent components or props.`;

export default function waveshareGenuiExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "genui",
    label: "Display",
    description: toolDescription,

    parameters: Type.Object({
      source: Type.String({
        description:
          "openui-lang source text. Must contain `root = Canvas(...)` as entry point.",
      }),
      priority: Type.Optional(
        Type.Union(
          [
            Type.Literal("low"),
            Type.Literal("normal"),
            Type.Literal("high"),
          ],
          { description: "Frame priority (default: normal)" },
        ),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { source, priority } = params as {
        source: string;
        priority?: string;
      };

      const prioFlag =
        priority && priority !== "normal" ? ` --priority ${priority}` : "";
      const cmd = `printf '%s' '${source.replace(/'/g, "'\\''")}' | waveshare-genui -${prioFlag}`;

      const result = await pi.exec("sh", ["-c", cmd]);

      if (result.code !== 0) {
        const message =
          result.stderr || result.stdout || "waveshare-genui failed";
        return {
          content: [
            { type: "text" as const, text: `Failed to render: ${message}` },
          ],
          isError: true,
          details: { exitCode: result.code, stderr: result.stderr },
        };
      }

      return {
        content: [],
        details: { exitCode: result.code },
      };
    },
  });
}
