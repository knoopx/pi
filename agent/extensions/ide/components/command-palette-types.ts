/** Argument definition from args section */
export interface ArgDefinition {
  default?: string;
  description?: string;
  /** Static choices (array) or shell command (string) */
  choices?: string | string[];
  required?: boolean;
}

export type ArgsSection = Record<string, ArgDefinition>;

/** Command definition from markdown file */
export interface FileCommand {
  name: string;
  description: string;
  template: string;
  hasShellCommands: boolean;
  filePath: string;
  args?: ArgsSection;
}

/** Unified command type for display */
export interface PaletteCommand {
  id: string;
  name: string;
  description: string;
  action: () => void;
}

export interface CommandPaletteTui {
  terminal: { rows: number };
  requestRender: () => void;
}

export interface CommandPaletteComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  invalidate: () => void;
  dispose: () => void;
}
