import { KeyId, matchesKey } from "@earendil-works/pi-tui";
function createKeyMatcher(
  data: string,
): (key: Parameters<typeof matchesKey>[1]) => boolean {
  const normalized = data.toLowerCase();
  return (key: Parameters<typeof matchesKey>[1]) =>
    matchesKey(data, key) || normalized === key;
}
function handleEscape(
  matches: ReturnType<typeof createKeyMatcher>,
  done: () => void,
): boolean {
  if (matches("escape") || matches("q")) {
    done();
    return true;
  }
  return false;
}
interface NavAction {
  keys: KeyId[];
  handler: () => void;
}

function buildNavActions(
  matches: ReturnType<typeof createKeyMatcher>,
  opts: Parameters<typeof handleUsageInput>[1],
): NavAction[] {
  const actions: NavAction[] = [
    { keys: ["tab", "right"], handler: opts.onTabForward },
    { keys: ["shift+tab", "left"], handler: opts.onTabBackward },
    { keys: ["up"], handler: opts.onUp },
    { keys: ["down"], handler: opts.onDown },
  ];
  if (opts.onEnter) {
    actions.push({ keys: ["enter", "space"], handler: opts.onEnter });
  }
  return actions;
}

export function handleUsageInput(
  data: string,
  opts: {
    done: () => void;
    onTabForward: () => void;
    onTabBackward: () => void;
    onUp: () => void;
    onDown: () => void;
    onEnter?: () => void;
  },
): void {
  const matches = createKeyMatcher(data);

  if (handleEscape(matches, opts.done)) return;

  for (const action of buildNavActions(matches, opts)) {
    if (action.keys.some(matches)) {
      action.handler();
      return;
    }
  }
}
