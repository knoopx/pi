import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";

export interface ListPickerItem {
  id: string;
  label: string;
  path?: string;
  startLine?: number;
  endLine?: number;
}

export interface ListPickerAction<T extends ListPickerItem> {
  key: string;
  label: string;
  handler: (item: T) => Promise<void> | void;
}

export interface ListPickerConfig<T extends ListPickerItem> {
  title: string | (() => string);
  loadItems: (query: string) => Promise<T[]>;
  filterItems: (items: T[], query: string) => T[];
  formatItem: (item: T, width: number, theme: Theme) => string;
  loadPreview: (item: T) => Promise<string[]>;
  previewTitle?: (item: T) => string;
  onEdit?: (item: T) => Promise<void> | void;
  actions?: ListPickerAction<T>[];
  reloadDebounceMs?: number;
  onKey?: (key: string, onReload?: () => void) => boolean;
}

interface ListPickerTui {
  terminal: { rows: number };
  requestRender: () => void;
}

export interface TitleContext<T extends ListPickerItem> {
  config: ListPickerConfig<T>;
  searchQuery: string;
  focusedItem: T | null;
  filteredCount: number;
  totalCount: number;
  leftW: number;
  rightW: number;
}

export interface ListPickerComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  dispose: () => void;
  setPreview: (lines: string[]) => void;
  invalidate: () => void;
  reload: () => Promise<void>;
  notify?: (message: string, type?: "info" | "error") => void;
  getSearchQuery?: () => string;
  clearSearchQuery?: () => void;
  focusedIndex?: number;
}

export interface ListPickerOptions<T extends ListPickerItem> {
  pi: ExtensionAPI;
  tui: ListPickerTui;
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: T | null) => void;
  initialQuery: string;
  config: ListPickerConfig<T>;
}
