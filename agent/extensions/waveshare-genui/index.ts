import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function waveshareGenuiExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "genui",
    label: "Display",
    description: `Render openui-lang to the 720×720 display.

## openui-lang syntax
Each statement: \`identifier = Expression\`. \`root = Canvas(...)\` is the entry point.
Expressions: strings \`"..."\`, numbers, booleans, arrays \`[...]\`, component calls \`TypeName(arg1, arg2, ...)\`.
Arguments are positional. Optional arguments are omitted from the end.
Every variable must be reachable from root.

## Priority levels
- high: notifications, alerts. Preempts whatever is on screen immediately. Holds 5s.
- normal (default): contextual info, status updates. 3s minimum display time.
- low: idle screens, background info (clocks, dashboards). 1s hold, yields to anything higher.

## Components

Layout: Canvas(children[]), Header(icon, title, subtitle?), Content(children[], gap?), Stack(children[], direction?, gap?, align?, justify?, wrap?), Card(children[]), Separator(), Spacer()

Text: Text(content, size?, weight?, color?, align?), Icon(glyph, color?, size?), Badge(label, color?)

Data: KeyValue(label, value, secondary?, color?), Stat(label, value, unit?, helper?, color?), Table(columns, rows), Col(label, align?), List(items), ListItem(text, secondary?, icon?, value?), Alert(title, message?, icon?, color?), EmptyState(title, message?, icon?, color?)

Viz: Gauge(label, value, max?, unit?, size?, color?), ProgressBar(label, value, max?, display?, color?), Sparkline(values[], color?, height?), StatusDot(up)

Media: Image(src, width?, height?, fit?, borderRadius?), QRCode(data, size?, color?)

Utility: Timestamp() — place as last Canvas child

## Component notes
- Canvas is always root. Header + Content is the standard page pattern.
- Header icon accepts a glyph string or Icon element. title/subtitle accept strings or child element arrays.
- Stack direction: "row"|"column" (default column). align: start|center|end|stretch. justify: start|center|end|between|around. wrap: true for grid layouts (2×2 gauges).
- Content gap: none(0)|xs(4)|sm(8)|md(16)|lg(24)|xl(32).
- Table: define Col refs first, pass rows as 2D string array. ~12 rows fit.
- List: define ListItem refs, pass as items array. ~8 items fit.
- Gauge: circular arc. Stack 2–4 in row+wrap for dashboard grids.
- Alert highlights important state changes. EmptyState is a fallback when no data.
- Image reads local files or data URIs, not remote URLs.

## Values
Colors: default, muted, accent, green, red, yellow, cyan, orange, purple (no hex)
Font sizes: xs(20), sm(22), md(26), lg(30), xl(36), 2xl(44), 3xl(80)
Gap: none(0), xs(4), sm(8), md(16), lg(24), xl(32)
Icons: Nerd Font glyphs as \\uXXXX — \\uf021 (sync), \\uf002 (search), \\uf044 (edit), \\uf00c (check), \\uf071 (warning), \\uf188 (bug), \\uf201 (chart), \\uf03a (list), \\uf108 (desktop), \\uf058 (circle-check), \\uf06a (exclamation), \\uf073 (calendar), \\uf017 (clock), \\uf015 (home), \\uf0eb (lightbulb), \\uf001 (music)
Font: Inter (text), Nerd Font (icons)

## Layout patterns

Standard page:
\`\`\`
root = Canvas([header, content, ts])
header = Header("\\uf021", "Title")
content = Content([child])
child = Text("Detail", "lg", "normal", "muted")
ts = Timestamp()
\`\`\`

Stats row:
\`\`\`
stats = Stack([s1, s2, s3], "row", "md", "stretch")
s1 = Stat("CPU", "73", "%", "", "green")
\`\`\`

Feed/list:
\`\`\`
list = List([ListItem("Title", "subtitle", "\\uf03a")])
\`\`\`

Gauge grid:
\`\`\`
root = Canvas([grid, ts])
grid = Stack([g1, g2, g3, g4], "row", "md", "center", "center", true)
g1 = Gauge("CPU", 73, 100, "%")
\`\`\`

Cards with sparklines:
\`\`\`
root = Canvas([header, content, ts])
header = Header("\\uf201", "Market")
content = Content([c1, c2], "sm")
c1 = Card([row1, spark1])
row1 = Stack([sym1, price1], "row", "sm", "center", "between")
sym1 = Text("AAPL", "md", "bold", "muted")
price1 = Text("$178.52", "lg", "bold")
spark1 = Sparkline([170, 172, 175, 173, 178], "green")
\`\`\`

Status monitor:
\`\`\`
content = Content([s1, sep1, s2])
s1 = Stack([StatusDot(true), Text("API", "md", "bold"), Badge("142ms", "green")], "row", "md", "center")
sep1 = Separator()
s2 = Stack([StatusDot(false), Text("CDN", "md", "bold"), Badge("DOWN", "red")], "row", "md", "center")
\`\`\`

KPI grid:
\`\`\`
grid = Stack([stat1, stat2, stat3, stat4], "row", "md", "stretch", "start", true)
stat1 = Stat("Revenue", "$24.8k", null, "+12%", "green")
stat2 = Stat("Orders", "182", null, "14 pending", "accent")
\`\`\`

Alert + empty state:
\`\`\`
content = Content([alert, empty], "lg")
alert = Alert("Maintenance", "Deploys paused until 22:00.", "\\uf071", "yellow")
empty = EmptyState("No pending deploys", "Check back later.", "\\uf058", "green")
\`\`\`

Table:
\`\`\`
tbl = Table(cols, rows)
cols = [Col("Name"), Col("Role"), Col("Status")]
rows = [["Alice", "Backend", "Active"], ["Bob", "Frontend", "On Leave"]]
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
