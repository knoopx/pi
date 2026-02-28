/**
 * Skill Browser Component
 *
 * 3-pane split layout for browsing local and remote skills
 * - Left: Skills list (local or remote)
 * - Right Top: Files in selected skill
 * - Right Bottom: Preview of selected file
 */

import type {
  ExtensionAPI,
  KeybindingsManager,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  ACTION_KEYS,
  createKeyboardHandler,
  buildHelpFromBindings,
  type KeyBinding,
} from "../keyboard";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import {
  searchSkills,
  fetchHotSkills,
  fetchSkillFiles,
  fetchFileContent,
  formatInstalls,
  formatSize,
  discoverLocalSkills,
  getLocalSkillFiles,
  readLocalFile,
  type RemoteSkill,
} from "./skills-api";
import {
  calculateDimensions,
  renderSplitPanel,
  type SplitPanelConfig,
} from "./split-panel";
import { truncateAnsi, ensureWidth, pad } from "./text-utils";
import { getFileIcon } from "./file-icons";
import { Key, Markdown } from "@mariozechner/pi-tui";
import { createMarkdownTheme } from "./formatting";

type ViewMode = "local" | "remote";
type FocusPane = "skills" | "files";

// Unified skill type for display
interface DisplaySkill {
  id: string;
  name: string;
  subtitle: string; // description for local, installs for remote
  isLocal: boolean;
  localPath?: string;
  remote?: RemoteSkill;
}

// Unified file type for display
interface DisplayFile {
  name: string;
  size: number;
  isLocal: boolean;
  localPath?: string;
  downloadUrl?: string;
}

interface SkillBrowserTui {
  terminal: { rows: number };
  requestRender: () => void;
}

interface SkillBrowserComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  dispose: () => void;
  invalidate: () => void;
}

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timeout: ReturnType<typeof setTimeout> | null;
}

export function createSkillBrowserComponent(
  _pi: ExtensionAPI,
  tui: SkillBrowserTui,
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result?: string) => void,
  initialQuery: string,
  ctx: ExtensionContext,
): SkillBrowserComponent {
  // View state
  let viewMode: ViewMode = "local";
  let focusPane: FocusPane = "skills";

  // Skills state
  let skills: DisplaySkill[] = [];
  let skillIndex = 0;
  let searchQuery = initialQuery;
  let loading = true;
  let error: string | null = null;

  // Files state
  let files: DisplayFile[] = [];
  let fileIndex = 0;
  let filesLoading = false;
  let filesError: string | null = null;

  // Preview state
  let previewContent: string | null = null;
  let previewRendered: string[] | null = null;
  let previewLoading = false;
  let previewError: string | null = null;
  let previewScroll = 0;

  // UI state
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  let statusMessage: StatusMessage | null = null;
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // Caches
  const filesCache = new Map<string, DisplayFile[]>();
  const contentCache = new Map<string, string>();

  // Show temporary status message
  function showStatus(text: string, type: "info" | "error" | "success"): void {
    if (statusMessage?.timeout) {
      clearTimeout(statusMessage.timeout);
    }
    statusMessage = {
      text,
      type,
      timeout: setTimeout(() => {
        statusMessage = null;
        invalidate();
        tui.requestRender();
      }, 3000),
    };
    invalidate();
    tui.requestRender();
  }

  // Invalidate render cache
  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  // Get currently focused skill
  function getFocusedSkill(): DisplaySkill | null {
    return skills.length > 0 ? skills[skillIndex] : null;
  }

  // Get currently focused file
  function getFocusedFile(): DisplayFile | null {
    return files.length > 0 ? files[fileIndex] : null;
  }

  // Generic skill loader with common loading/error handling
  async function loadSkillsGeneric(
    fetcher: () => Promise<DisplaySkill[]>,
  ): Promise<void> {
    loading = true;
    error = null;
    invalidate();
    tui.requestRender();

    try {
      skills = await fetcher();
      skillIndex = 0;
      loading = false;
      invalidate();
      tui.requestRender();

      const skill = getFocusedSkill();
      if (skill) void loadFiles(skill);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
      invalidate();
      tui.requestRender();
    }
  }

  // Load skills based on current mode
  async function loadSkills(): Promise<void> {
    if (viewMode === "local") {
      await loadSkillsGeneric(async () => {
        const localSkills = await discoverLocalSkills(ctx.cwd);
        return localSkills
          .filter(
            (s) =>
              !searchQuery ||
              s.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
          .map((s) => ({
            id: s.name,
            name: s.name,
            subtitle: s.description,
            isLocal: true,
            localPath: s.path,
          }));
      });
    } else {
      await loadSkillsGeneric(async () => {
        const remoteSkills = searchQuery.trim()
          ? await searchSkills(searchQuery, 100)
          : await fetchHotSkills();
        return remoteSkills.map((s) => ({
          id: s.id,
          name: s.name,
          subtitle: formatInstalls(s.installs),
          isLocal: false,
          remote: s,
        }));
      });
    }
  }

  // Schedule search with debounce
  function scheduleSearch(): void {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    searchDebounce = setTimeout(() => {
      void loadSkills();
    }, 300);
  }

  // Load files for a skill
  async function loadFiles(skill: DisplaySkill): Promise<void> {
    // Check cache
    const cached = filesCache.get(skill.id);
    if (cached) {
      files = cached;
      fileIndex = 0;
      filesError = null;
      invalidate();
      tui.requestRender();

      const file = getFocusedFile();
      if (file) {
        void loadPreview(file);
      }
      return;
    }

    filesLoading = true;
    filesError = null;
    files = [];
    fileIndex = 0;
    previewContent = null;
    previewRendered = null;
    invalidate();
    tui.requestRender();

    try {
      let loadedFiles: DisplayFile[];

      if (skill.isLocal && skill.localPath) {
        const localFiles = await getLocalSkillFiles(skill.localPath);
        loadedFiles = localFiles.map((f) => ({
          name: f.name,
          size: f.size,
          isLocal: true,
          localPath: f.path,
        }));
      } else if (skill.remote) {
        const remoteFiles = await fetchSkillFiles(skill.remote);
        loadedFiles = remoteFiles.map((f) => ({
          name: f.name,
          size: f.size,
          isLocal: false,
          downloadUrl: f.downloadUrl,
        }));
      } else {
        loadedFiles = [];
      }

      filesCache.set(skill.id, loadedFiles);
      files = loadedFiles;
      fileIndex = 0;
      filesLoading = false;
      invalidate();
      tui.requestRender();

      // Load preview for first file (prefer SKILL.md)
      const skillMd = files.find((f) => f.name === "SKILL.md");
      const firstFile = skillMd || files[0];
      if (firstFile) {
        fileIndex = files.indexOf(firstFile);
        void loadPreview(firstFile);
      }
    } catch (e) {
      filesError = e instanceof Error ? e.message : String(e);
      filesLoading = false;
      invalidate();
      tui.requestRender();
    }
  }

  // Load preview for a file
  async function loadPreview(file: DisplayFile): Promise<void> {
    const cacheKey = file.localPath || file.downloadUrl || file.name;

    // Check cache
    const cached = contentCache.get(cacheKey);
    if (cached) {
      previewContent = cached;
      previewRendered = null;
      previewScroll = 0;
      previewError = null;
      invalidate();
      tui.requestRender();
      return;
    }

    previewLoading = true;
    previewError = null;
    invalidate();
    tui.requestRender();

    try {
      let content: string;

      if (file.isLocal && file.localPath) {
        content = await readLocalFile(file.localPath);
      } else if (file.downloadUrl) {
        content = await fetchFileContent(file.downloadUrl);
      } else {
        throw new Error("No file source");
      }

      contentCache.set(cacheKey, content);
      previewContent = content;
      previewRendered = null;
      previewScroll = 0;
      previewLoading = false;
      invalidate();
      tui.requestRender();
    } catch (e) {
      previewError = e instanceof Error ? e.message : String(e);
      previewContent = null;
      previewRendered = null;
      previewLoading = false;
      invalidate();
      tui.requestRender();
    }
  }

  // Install remote skill
  async function installSkill(): Promise<void> {
    const skill = getFocusedSkill();
    if (!skill || skill.isLocal) {
      showStatus("Select a remote skill to install", "info");
      return;
    }

    if (files.length === 0) {
      showStatus("No files to install", "error");
      return;
    }

    const skillsDir = join(ctx.cwd, "agent", "skills", skill.name);

    if (existsSync(skillsDir)) {
      showStatus(`Skill "${skill.name}" already installed`, "info");
      return;
    }

    try {
      mkdirSync(skillsDir, { recursive: true });

      for (const file of files) {
        if (!file.downloadUrl) continue;
        const content =
          contentCache.get(file.downloadUrl) ||
          (await fetchFileContent(file.downloadUrl));
        const filePath = join(skillsDir, file.name);
        writeFileSync(filePath, content);
      }

      showStatus(
        `Installed "${skill.name}" (${files.length} files)`,
        "success",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showStatus(`Failed to install: ${msg}`, "error");
    }
  }

  // Delete local skill
  async function deleteSkill(): Promise<void> {
    const skill = getFocusedSkill();
    if (!skill || !skill.isLocal || !skill.localPath) {
      showStatus("Select a local skill to delete", "info");
      return;
    }

    try {
      rmSync(skill.localPath, { recursive: true });
      showStatus(`Deleted "${skill.name}"`, "success");

      // Reload local skills
      filesCache.delete(skill.id);
      void loadSkills();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showStatus(`Failed to delete: ${msg}`, "error");
    }
  }

  // Style a row based on focus state
  function styleRow(
    text: string,
    isFocused: boolean,
    isSelected: boolean,
  ): string {
    if (isFocused) return theme.fg("accent", theme.bold(text));
    if (isSelected) return theme.fg("warning", text);
    return text;
  }

  // Render skills list rows
  function renderSkillRows(width: number, height: number): string[] {
    const rows: string[] = [];

    if (loading) {
      rows.push(theme.fg("dim", pad(" Loading skills...", width)));
      return rows;
    }

    if (error) {
      rows.push(theme.fg("error", pad(` Error: ${error}`, width)));
      return rows;
    }

    if (skills.length === 0) {
      const msg =
        viewMode === "local" ? " No local skills" : " No skills found";
      rows.push(theme.fg("dim", pad(msg, width)));
      return rows;
    }

    let startIdx = 0;
    if (skillIndex >= height) {
      startIdx = skillIndex - height + 1;
    }

    for (let i = 0; i < height && startIdx + i < skills.length; i++) {
      const idx = startIdx + i;
      const skill = skills[idx];
      const icon = skill.isLocal ? "󰉋" : "󰛦";
      const text = ` ${icon} ${skill.name} ${theme.fg("dim", skill.subtitle)}`;
      const padded = ensureWidth(truncateAnsi(text, width - 1), width);
      const isFocused = idx === skillIndex && focusPane === "skills";
      rows.push(styleRow(padded, isFocused, idx === skillIndex));
    }

    return rows;
  }

  // Render files list rows
  function renderFileRows(width: number, height: number): string[] {
    const rows: string[] = [];

    if (filesLoading) {
      rows.push(theme.fg("dim", pad(" Loading files...", width)));
      return rows;
    }

    if (filesError) {
      rows.push(theme.fg("warning", pad(` ${filesError}`, width)));
      return rows;
    }

    if (files.length === 0) {
      rows.push(theme.fg("dim", pad(" No files", width)));
      return rows;
    }

    let startIdx = 0;
    if (fileIndex >= height) {
      startIdx = fileIndex - height + 1;
    }

    for (let i = 0; i < height && startIdx + i < files.length; i++) {
      const idx = startIdx + i;
      const file = files[idx];
      const icon = getFileIcon(file.name);
      const size = formatSize(file.size);
      const text = ` ${icon} ${file.name} ${theme.fg("dim", size)}`;
      const padded = ensureWidth(truncateAnsi(text, width - 1), width);
      const isFocused = idx === fileIndex && focusPane === "files";
      rows.push(styleRow(padded, isFocused, idx === fileIndex));
    }

    return rows;
  }

  // Render preview content
  function renderPreviewRows(width: number, height: number): string[] {
    const rows: string[] = [];

    if (previewLoading) {
      rows.push(theme.fg("dim", pad(" Loading preview...", width)));
      return rows;
    }

    if (previewError) {
      rows.push(theme.fg("warning", pad(` ${previewError}`, width)));
      return rows;
    }

    if (!previewContent) {
      rows.push(theme.fg("dim", pad(" Select a file to preview", width)));
      return rows;
    }

    if (!previewRendered) {
      const file = getFocusedFile();
      const isMarkdown = file?.name.endsWith(".md") ?? false;

      if (isMarkdown) {
        const mdTheme = createMarkdownTheme(theme);
        const md = new Markdown(previewContent, 0, 0, mdTheme);
        previewRendered = md.render(width - 2);
      } else {
        previewRendered = previewContent.split("\n");
      }
    }

    const visible = previewRendered.slice(
      previewScroll,
      previewScroll + height,
    );

    for (const line of visible) {
      const text = " " + line;
      const truncated = truncateAnsi(text, width - 1);
      const padded = ensureWidth(truncated, width);
      rows.push(padded);
    }

    while (rows.length < height) {
      rows.push(pad("", width));
    }

    return rows;
  }

  // Main render function
  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const skill = getFocusedSkill();
    const file = getFocusedFile();

    const modeLabel = viewMode === "local" ? "Local" : "Remote";
    const leftTitle = searchQuery
      ? ` ${modeLabel}: ${truncateAnsi(searchQuery, 15)}`
      : ` ${modeLabel} Skills`;

    const config: SplitPanelConfig = {
      leftTitle,
      rightTitle: "",
      rightTopTitle: skill ? ` ${truncateAnsi(skill.name, 30)}` : " Files",
      rightBottomTitle: file ? ` ${truncateAnsi(file.name, 30)}` : " Preview",
      helpText: getHelpText(),
      leftFocus: focusPane === "skills",
      rightFocus: focusPane === "files",
      leftRatio: 0.35,
      rightSplit: true,
      rightTopRatio: 0.35,
    };

    const dims = calculateDimensions(tui.terminal.rows, width, config);

    const leftRows = renderSkillRows(dims.leftW, dims.contentH);
    const rightTopRows = renderFileRows(dims.rightW, dims.rightTopH || 5);
    const rightBottomRows = renderPreviewRows(
      dims.rightW,
      dims.rightBottomH || 10,
    );

    cachedLines = renderSplitPanel(theme, config, dims, {
      left: leftRows,
      rightTop: rightTopRows,
      rightBottom: rightBottomRows,
    });

    cachedWidth = width;
    return cachedLines;
  }

  // Helper conditions
  const isSkillsFocus = () => focusPane === "skills";
  const isLocalMode = () => viewMode === "local";
  const isRemoteMode = () => viewMode === "remote";
  const hasSkill = () => skills.length > 0 && skillIndex < skills.length;

  // Navigation helpers
  const navigateSkills = (direction: "up" | "down") => {
    const newIndex =
      direction === "up"
        ? Math.max(0, skillIndex - 1)
        : Math.min(skills.length - 1, skillIndex + 1);
    if (newIndex !== skillIndex) {
      skillIndex = newIndex;
      const skill = getFocusedSkill();
      if (skill) void loadFiles(skill);
      invalidate();
      tui.requestRender();
    }
  };

  const navigateFiles = (direction: "up" | "down") => {
    const newIndex =
      direction === "up"
        ? Math.max(0, fileIndex - 1)
        : Math.min(files.length - 1, fileIndex + 1);
    if (newIndex !== fileIndex) {
      fileIndex = newIndex;
      const file = getFocusedFile();
      if (file) void loadPreview(file);
      invalidate();
      tui.requestRender();
    }
  };

  const scrollPreview = (direction: "up" | "down") => {
    if (direction === "up") {
      previewScroll = Math.max(0, previewScroll - 10);
    } else if (previewRendered) {
      const maxScroll = Math.max(0, previewRendered.length - 10);
      previewScroll = Math.min(maxScroll, previewScroll + 10);
    }
    invalidate();
    tui.requestRender();
  };

  const toggleView = () => {
    viewMode = viewMode === "local" ? "remote" : "local";
    searchQuery = "";
    filesCache.clear();
    contentCache.clear();
    void loadSkills();
  };

  const selectSkill = () => {
    const skill = getFocusedSkill();
    if (!skill) return;
    if (skill.isLocal) {
      done(`/skill:${skill.name}`);
    } else {
      void installSkill();
    }
  };

  // Global bindings
  const globalBindings: KeyBinding[] = [
    {
      key: "up",
      label: "nav",
      handler: () => {
        if (isSkillsFocus()) navigateSkills("up");
        else navigateFiles("up");
      },
    },
    {
      key: "down",
      handler: () => {
        if (isSkillsFocus()) navigateSkills("down");
        else navigateFiles("down");
      },
    },
    {
      key: "tab",
      label: "pane",
      handler: () => {
        focusPane = focusPane === "skills" ? "files" : "skills";
        invalidate();
        tui.requestRender();
      },
    },
    { key: Key.ctrl("/"), label: "toggle", handler: toggleView },
    {
      key: Key.ctrl("i"),
      label: "insert",
      when: () => hasSkill() && isLocalMode(),
      handler: selectSkill,
    },
    {
      key: "enter",
      label: "install",
      when: () => hasSkill() && isRemoteMode(),
      handler: () => {
        void installSkill();
      },
    },
    {
      key: ACTION_KEYS.delete,
      label: "delete",
      when: isLocalMode,
      handler: () => {
        void deleteSkill();
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        scrollPreview("up");
      },
    },
    {
      key: "pageDown",
      handler: () => {
        scrollPreview("down");
      },
    },
    {
      key: "escape",
      handler: () => {
        done();
      },
    },
  ];

  // Generate help text from active bindings
  function getHelpText(): string {
    if (statusMessage) {
      const color =
        statusMessage.type === "error"
          ? "error"
          : statusMessage.type === "success"
            ? "accent"
            : "dim";
      return theme.fg(color, statusMessage.text);
    }

    const activeBindings = globalBindings.filter((b) => {
      if (!b.label) return false;
      if (b.when && !b.when(undefined as never)) return false;
      return true;
    });
    return buildHelpFromBindings(activeBindings);
  }

  // Create keyboard handler
  const keyboardHandler = createKeyboardHandler({
    bindings: globalBindings,
    onBackspace: () => {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        scheduleSearch();
        invalidate();
        tui.requestRender();
      }
    },
    onTextInput: (char) => {
      searchQuery += char;
      scheduleSearch();
      invalidate();
      tui.requestRender();
    },
  });

  function handleInput(data: string): void {
    keyboardHandler(data);
  }

  // Cleanup
  function dispose(): void {
    if (statusMessage?.timeout) {
      clearTimeout(statusMessage.timeout);
    }
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    filesCache.clear();
    contentCache.clear();
  }

  // Start with local skills
  void loadSkills();

  return {
    render,
    handleInput,
    dispose,
    invalidate,
  };
}
