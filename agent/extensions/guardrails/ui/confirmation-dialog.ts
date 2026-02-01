import { Key, matchesKey } from "@mariozechner/pi-tui";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
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

/**
 * Reusable confirmation dialog component for pi framework
 */
export function createConfirmationDialog(
  options: ConfirmationDialogOptions,
  theme: any,
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
  const borderColor = danger ? "error" : "warning";
  const borderFn = (s: string) => theme.fg(borderColor, s);

  container.addChild(new DynamicBorder(borderFn));
  container.addChild(new Text(theme.fg(borderColor, theme.bold(title)), 1, 0));
  container.addChild(new Spacer(1));

  if (message) {
    container.addChild(new Text(theme.fg("warning", message), 1, 0));
    container.addChild(new Spacer(1));
  }

  if (content) {
    container.addChild(new DynamicBorder((s: string) => theme.fg("muted", s)));
    container.addChild(
      new Text(wrapTextWithAnsi(theme.fg("text", content), 0).join("\n"), 1, 0),
    );
    container.addChild(new DynamicBorder((s: string) => theme.fg("muted", s)));
    container.addChild(new Spacer(1));
  }

  container.addChild(
    new Text(theme.fg("dim", `${confirmText} • ${cancelText}`), 1, 0),
  );
  container.addChild(new DynamicBorder(borderFn));

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
