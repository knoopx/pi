import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function waveshareGenuiExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "genui",
    label: "Display",
    description: `Render openui-lang to the 720×720 display.

## openui-lang syntax
Each statement: \`identifier = Expression\`. \`root = Canvas(...)\` is the entry point.
Expressions: strings \`"..."\`, numbers, booleans, arrays \`[...]\`, objects \`{...}\`, component calls \`TypeName(arg1, arg2, ...)\`.
Arguments are positional. Optional arguments are omitted from the end.
Every variable must be reachable from root.

## Priority levels
- high: notifications, alerts. Preempts whatever is on screen immediately. Holds 5s.
- normal (default): contextual info, status updates. 3s minimum display time.
- low: idle screens, background info (clocks, dashboards). 1s hold, yields to anything higher.

## Components

Layout: Canvas(children[]), Header(icon, title, subtitle?), Content(children[], gap?), Stack(children[], direction?, gap?, align?, justify?, wrap?), Card(children[], variant?), Separator(), Spacer()

Content: Text(content, size?, weight?, color?, align?), Icon(glyph, color?, size?), Badge(label, color?), CodeBlock(language, codeString), Alert(title, message?, icon?, color?), EmptyState(title, message?, icon?, color?), Timestamp()

Data Display: Table(columns, rows), Col(label, type?, align?), List(items), ListItem(text, secondary?, icon?, value?), KeyValue(label, value, secondary?, color?), Stat(label, value, unit?, helper?, color?), Steps(items), StepsItem(title, details?), TagBlock(tags), Tag(text, icon?, color?)

Data Visualization: Gauge(label, value, max?, unit?, size?, color?), ProgressBar(label, value, max?, display?, color?), Sparkline(values[], color?, height?), StatusDot(up)

Media: Image(src, width?, height?, fit?, borderRadius?), QRCode(data, size?, color?)

## Icons

Use named icon strings everywhere: Header("check", ...), Alert(..., "warning"), ListItem(..., "cart").
For custom icon color/size, use Icon element: Header(Icon("warning", "red"), ...).

Available names: check, warning, error, info, question, home, search, settings, menu, list, grid, edit, sync, refresh, clock, calendar, mail, bell, lock, globe, link, file, folder, image, music, video, camera, lightbulb, bolt, tag, bookmark, star, heart, user, users, cart, database, server, desktop, cloud, wifi, rss, up, down, left, right, location, chart, bars, table, steps, play, pause, stop, download, upload, trash, plus, minus, toggle, code, bug, git, github, terminal, cpu, memory, disk, thermometer, train, rocket, docker, nix, react, rust, python, circle, dot, shield, flag, trophy, monitor, qrcode, palette.

## Component notes
- Canvas is always root. Header + Content is the standard page pattern.
- Header icon accepts a name string or Icon element. title/subtitle accept strings or child element arrays.
- Stack direction: "row"|"column" (default column). align: start|center|end|stretch|baseline. justify: start|center|end|between|around|evenly. wrap: true for grid layouts (2×2 gauges).
- Content gap: none(0)|xs(4)|sm(8)|md(16)|lg(24)|xl(32).
- Card variant: "card" (default, elevated), "sunk" (recessed), "clear" (transparent, padding only).
- Col type: "string" (left-aligned) or "number" (right-aligned). align overrides type default.
- Table: define Col refs first, pass rows as 2D string/number array. ~12 rows fit.
- List: define ListItem refs, pass as items array. ~8 items fit.
- Gauge: circular arc. Stack 2–4 in row+wrap for dashboard grids.
- CodeBlock: displays code with a language label and monospace font.
- Steps: numbered sequential process with title and optional details per step.
- TagBlock: flow-wrapped group of Tag pills with optional icons and colors.
- Alert highlights important state changes. EmptyState is a fallback when no data.
- Image reads local files or data URIs, not remote URLs.
- Timestamp auto-displays current time; place as last Canvas child.

## Values
Colors: default, muted, accent, green, red, yellow, cyan, orange, purple (no hex)
Font sizes: xs(20), sm(22), md(26), lg(30), xl(36), 2xl(44), 3xl(80)
Gap: none(0), xs(4), sm(8), md(16), lg(24), xl(32)
Font: Inter (text), Nerd Font (icons)

## Layout patterns

Standard page — Header for context, Content for body:
\`\`\`
root = Canvas([header, content, ts])
header = Header("check", "Build Complete")
content = Content([msg])
msg = Text("All 42 tests passed. Deployed to staging.", "xl", "normal", "muted")
ts = Timestamp()
\`\`\`

Full-screen centered — clock, message, timer. No Header/Content:
\`\`\`
root = Canvas([center, ts])
center = Stack([time, date], "column", "lg", "center", "center")
time = Text("14:30", "3xl", "bold")
date = Text("Monday, March 13", "lg", "normal", "muted")
ts = Timestamp()
\`\`\`

Gauge dashboard — row of gauges, wrap for >3:
\`\`\`
root = Canvas([grid, ts])
grid = Stack([g1, g2, g3, g4], "row", "xl", "center", "center", true)
g1 = Gauge("CPU", 73, 100, "%")
g2 = Gauge("RAM", 4.2, 8, "GB")
g3 = Gauge("Disk", 120, 500, "GB")
g4 = Gauge("Temp", 62, 100, "°C")
ts = Timestamp()
\`\`\`

Feed/list — Header + Content + List for news, tasks, departures:
\`\`\`
root = Canvas([header, content, ts])
header = Header("list", "To Do")
content = Content([list])
list = List(items)
items = [ListItem("Buy groceries", "Milk, bread, eggs", "cart"), ListItem("Review PR #284", "Auth refactor", "git", "3")]
ts = Timestamp()
\`\`\`

Stats row + info card — Stat cards across top, KeyValue details below:
\`\`\`
root = Canvas([header, content, ts])
header = Header("desktop", "System")
content = Content([stats, card], "md")
stats = Stack([s1, s2, s3], "row", "md", "stretch")
s1 = Stat("Memory", "42", "%", "3.2 / 7.6 GB", "green")
s2 = Stat("Disk", "71%", "", "340 / 480 GB", "orange")
s3 = Stat("Load", "1.23", "", "", "cyan")
card = Card([details])
details = Stack([kv1, kv2, kv3], "column", "xs")
kv1 = KeyValue("Kernel", "6.6.10")
kv2 = KeyValue("CPU", "8", "logical cores")
kv3 = KeyValue("Uptime", "3d 12h")
ts = Timestamp()
\`\`\`

Cards with sparklines — Card per item, Badge + Sparkline:
\`\`\`
root = Canvas([header, content, ts])
header = Header("chart", "Market")
content = Content([card1], "sm")
card1 = Card([row1, spark1])
row1 = Stack([sym, badge, spacer, price], "row", "sm", "center")
sym = Text("AAPL", "md", "bold", "muted")
badge = Badge("+1.42%", "green")
spacer = Spacer()
price = Text("$198.50", "lg", "bold")
spark1 = Sparkline([195, 196, 197, 198, 198.5], "green")
ts = Timestamp()
\`\`\`

Mixed gauges + list — gauges on top, Separator, then List below:
\`\`\`
root = Canvas([header, content, ts])
header = Header("desktop", "System Monitor")
content = Content([gauges, sep, list])
gauges = Stack([g1, g2, g3], "row", "xl", "center", "center")
g1 = Gauge("CPU", 45, 100, "%", 160)
g2 = Gauge("RAM", 62, 100, "%", 160)
g3 = Gauge("Disk", 88, 100, "%", 160, "orange")
sep = Separator()
list = List([i1, i2])
i1 = ListItem("CPU Freq: 3200 MHz", "", "cpu")
i2 = ListItem("Load: 1.2 / 0.8 / 0.5", "", "settings")
ts = Timestamp()
\`\`\`

Side-by-side cards — two Card columns in a row:
\`\`\`
root = Canvas([header, content, ts])
header = Header("globe", "Network")
content = Content([row], "md")
row = Stack([dl, ul], "row", "md", "center", "center")
dl = Card([dlStack])
dlStack = Stack([dlLabel, dlVal, dlTotal], "column", "xs", "center")
dlLabel = Text("Download", "sm", "muted")
dlVal = Text("12.4 MB/s", "2xl", "bold", "accent")
dlTotal = Text("total 1.2 GB", "sm", "muted")
ul = Card([ulStack])
ulStack = Stack([ulLabel, ulVal, ulTotal], "column", "xs", "center")
ulLabel = Text("Upload", "sm", "muted")
ulVal = Text("840 KB/s", "2xl", "bold", "accent")
ulTotal = Text("total 320 MB", "sm", "muted")
ts = Timestamp()
\`\`\`

Status monitor:
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

KPI grid:
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

Alert + empty state:
\`\`\`
root = Canvas([header, content, ts])
header = Header("info", "Deployments")
content = Content([alert, empty], "lg")
alert = Alert("Maintenance Window", "Production deploys are paused until 22:00.", "warning", "yellow")
empty = EmptyState("No pending deploys", "Everything is shipped. Check back after the freeze.", "check", "green")
ts = Timestamp()
\`\`\`

Table:
\`\`\`
root = Canvas([header, content, ts])
header = Header("table", "Team Roster")
content = Content([tbl])
tbl = Table(cols, rows)
cols = [Col("Name"), Col("Role"), Col("Status")]
rows = [["Alice", "Backend", "Active"], ["Bob", "Frontend", "Active"], ["Carol", "DevOps", "On Leave"]]
ts = Timestamp()
\`\`\`

Steps process:
\`\`\`
root = Canvas([header, content, ts])
header = Header("steps", "Setup Guide")
content = Content([steps])
steps = Steps([StepsItem("Install dependencies", "Run bun install in the project root."), StepsItem("Configure environment", "Copy .env.example to .env and fill in values."), StepsItem("Start development", "Run bun run dev to launch the dev server.")])
ts = Timestamp()
\`\`\`

Code block:
\`\`\`
root = Canvas([header, content, ts])
header = Header("code", "Snippet")
content = Content([code])
code = CodeBlock("typescript", "const greeting = (name: string) =>\\n  \\\`Hello, \\\${name}!\\\`;\\n\\nconsole.log(greeting(\\"world\\"));")
ts = Timestamp()
\`\`\`

Tag cloud:
\`\`\`
root = Canvas([header, content, ts])
header = Header("tag", "Topics")
content = Content([tags])
tags = TagBlock([Tag("TypeScript", "code", "accent"), Tag("React", "react", "cyan"), Tag("Rust", "rust", "orange"), Tag("NixOS", "nix", "purple"), Tag("Docker", "docker", "cyan")])
ts = Timestamp()
\`\`\`

Icon with custom color:
\`\`\`
root = Canvas([header, content, ts])
header = Header(Icon("warning", "red"), "Alerts")
content = Content([row])
row = Stack([Icon("check", "green", 40), Text("All systems operational", "lg")], "row", "md", "center")
ts = Timestamp()
\`\`\`

## Hoisting & Streaming

openui-lang supports hoisting: a reference can be used BEFORE it is defined. The parser resolves all references after the full input is parsed.

**Statement order for optimal streaming:**
1. \`root = Canvas(...)\` — UI shell appears immediately
2. Component definitions — fill in as they stream
3. Data values — leaf content last

Always write root = Canvas(...) first so the UI shell appears immediately.

## Constraints
720×720 px. All text content must be strings, not numbers. Semantic colors only. Do not invent components or props.`,

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
