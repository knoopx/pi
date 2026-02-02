import { Key, matchesKey } from "@mariozechner/pi-tui";
import {
  Container,
  Spacer,
  Text,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

export interface ConfirmationDialogOptions {
  title: string;
  message: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface Theme {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

/**
 * Reusable confirmation dialog component for pi framework
 */
export function createConfirmationDialog(
  options: ConfirmationDialogOptions,
  theme: Theme,
  done: (confirmed: boolean) => void,
) {
  const {
    title,
    message,
    content,
    confirmText = "y/enter: confirm",
    cancelText = "n/esc: cancel",
    danger = false,
  } = options;

  const container = new Container();
  const borderChar = danger ? "!" : "─";
  const borderColor = danger ? "error" : "warning";

  // Simple border using text
  const borderLine = (s: string) => theme.fg(borderColor, s);

  container.addChild(new Text(borderLine(borderChar.repeat(50)), 0, 0));
  container.addChild(new Text(theme.fg(borderColor, theme.bold(title)), 1, 0));
  container.addChild(new Spacer(1));

  if (message) {
    container.addChild(new Text(theme.fg("warning", message), 1, 0));
    container.addChild(new Spacer(1));
  }

  if (content) {
    container.addChild(new Text(borderLine(borderChar.repeat(30)), 0, 0));
    container.addChild(
      new Text(wrapTextWithAnsi(theme.fg("text", content), 0).join("\n"), 1, 0),
    );
    container.addChild(new Text(borderLine(borderChar.repeat(30)), 0, 0));
    container.addChild(new Spacer(1));
  }

  container.addChild(
    new Text(theme.fg("dim", `${confirmText} • ${cancelText}`), 1, 0),
  );
  container.addChild(new Text(borderLine(borderChar.repeat(50)), 0, 0));

  return {
    render: (width: number) => {
      return container.render(width);
    },
    invalidate: () => container.invalidate(),
    handleInput: (data: string) => {
      if (matchesKey(data, Key.enter) || data === "y" || data === "Y") {
        done(true);
      } else if (matchesKey(data, Key.escape) || data === "n" || data === "N") {
        done(false);
      }
    },
  };
}
