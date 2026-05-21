export interface Edit {
  name: string;
}

interface EditState {
  current: Edit | null;
}

const state: EditState = { current: null };

export function beginEdit(name: string): void {
  state.current = { name };
}

export function finishEdit(): Edit | null {
  const edit = state.current;
  state.current = null;
  return edit ?? null;
}

export function getCurrentEdit(): Edit | null {
  return state.current;
}

export function resetState(): void {
  state.current = null;
}
