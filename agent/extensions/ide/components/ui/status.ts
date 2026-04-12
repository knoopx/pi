import type { Theme } from "@mariozechner/pi-coding-agent";

/** Status message state for notifications within overlays */
export interface StatusMessageState {
  message: { text: string; type: "info" | "error" } | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

/** Creates a status message handler for overlay components */
export function createStatusNotifier(
  state: StatusMessageState,
  onUpdate: () => void,
  duration = 3000,
): (message: string, type?: "info" | "error") => void {
  return (message: string, type: "info" | "error" = "info") => {
    if (state.timeout) clearTimeout(state.timeout);
    state.message = { text: message, type };
    onUpdate();
    state.timeout = setTimeout(() => {
      state.message = null;
      onUpdate();
    }, duration);
  };
}

/** Format help text with optional status message override */
export function formatHelpWithStatus(
  theme: Theme,
  statusMessage: { text: string; type: "info" | "error" } | null,
  helpText: string,
): string {
  if (statusMessage)
    return theme.fg(
      statusMessage.type === "error" ? "error" : "accent",
      statusMessage.text,
    );
  return helpText;
}
