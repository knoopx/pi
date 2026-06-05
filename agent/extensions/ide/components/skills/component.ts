import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { Key, type TUI } from "@earendil-works/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker/picker";
import type { SkillInfo } from "./types";
import { loadPreviewFromPath } from "../../lib/file-preview";
import { registry, type SkillEntry } from "../../../../shared/skills/registry";

const TYPE_ICONS: Record<SkillInfo["skillType"], string> = {
  knowledge: "\uf02d",
  protocol: "\uf132",
  tool: "\uf0ad",
  record: "\uf03a",
};

function inferSkillType(path: string): SkillInfo["skillType"] {
  if (path.includes("/knowledge/")) return "knowledge";
  if (path.includes("/protocols/")) return "protocol";
  if (path.includes("/tools/")) return "tool";
  if (path.includes("/records/")) return "record";
  return "knowledge";
}

async function loadSkills(): Promise<SkillInfo[]> {
  const entries = registry.getAll();
  return entries
    .map((e: SkillEntry) => ({
      id: e.name,
      label: e.name,
      name: e.name,
      topic: e.topic,
      description: e.description,
      skillType: inferSkillType(e.path),
      keywords: e.keywords,
      path: e.path,
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

function formatSkillItem(
  item: SkillInfo,
  _width: number,
  theme: Theme,
): string {
  const icon = TYPE_ICONS[item.skillType];
  const desc = item.description
    ? theme.fg("dim", ` — ${item.description}`)
    : "";
  return `${icon} ${item.topic}${desc}`;
}

export function filterSkills(items: SkillInfo[], query: string): SkillInfo[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => {
    const haystack = [item.name, item.topic, item.description, ...item.keywords]
      .join(" ")
      .toLowerCase();
    return haystack.includes(lower);
  });
}

interface SkillsComponentOptions {
  pi: ExtensionAPI;
  tui: TUI;
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SkillInfo | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
}

export function createSkillsComponent(
  options: SkillsComponentOptions,
): ListPickerComponent {
  const { tui, theme, done, initialQuery } = options;
  return createListPicker<SkillInfo>({
    pi: options.pi,
    tui,
    theme,
    keybindings: options.keybindings,
    done,
    initialQuery,
    config: {
      title: "Skills",
      loadItems: () => loadSkills(),
      filterItems: (items, query) => filterSkills(items, query),
      formatItem: (item, width) => formatSkillItem(item, width, theme),
      loadPreview: (item) => loadPreviewFromPath("", item.path, theme),
      actions: [
        {
          key: Key.ctrl("i"),
          label: "insert",
          handler: (item) => {
            done(item);
          },
        },
      ],
    },
  });
}
