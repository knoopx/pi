const DEFAULT_MIN_INTERVAL_MS = 1000;

interface HostState {
  lastRequest: number;
  queue: (() => void)[];
  draining: boolean;
}

interface ThrottleConfig {
  disabled: boolean;
  hosts: Map<string, HostState>;
}

const config: ThrottleConfig = { disabled: false, hosts: new Map() };
export function disableThrottle(): void {
  config.disabled = true;
}

function getState(host: string): HostState {
  let hostState = config.hosts.get(host);
  if (!hostState) {
    hostState = { lastRequest: 0, queue: [], draining: false };
    config.hosts.set(host, hostState);
  }
  return hostState;
}
function drain(state: HostState, minInterval: number): void {
  if (state.draining) return;
  state.draining = true;
  const tick = () => {
    const next = state.queue.shift();
    if (!next) {
      state.draining = false;
      return;
    }
    const now = Date.now();
    const elapsed = now - state.lastRequest;
    const delay = Math.max(0, minInterval - elapsed);

    if (delay === 0) {
      state.lastRequest = now;
      next();
      tick();
    } else {
      setTimeout(() => {
        state.lastRequest = Date.now();
        next();
        tick();
      }, delay);
    }
  };

  tick();
}
export function acquireSlot(
  host: string,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): Promise<void> {
  if (config.disabled) return Promise.resolve();
  const state = getState(host);
  const now = Date.now();
  const elapsed = now - state.lastRequest;

  if (state.queue.length === 0 && elapsed >= minIntervalMs) {
    state.lastRequest = now;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    state.queue.push(resolve);
    drain(state, minIntervalMs);
  });
}
function extractHost(input: string | URL | Request): string {
  const urlStr = input instanceof Request ? input.url : String(input);
  try {
    return new URL(urlStr).hostname;
  } catch {
    return urlStr;
  }
}
export async function throttledFetch(
  input: string | URL | Request,
  init?: RequestInit,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): Promise<Response> {
  const host = extractHost(input);
  await acquireSlot(host, minIntervalMs);
  return fetch(input, init);
}
export function resetThrottleState(): void {
  config.hosts.clear();
  config.disabled = false;
}
