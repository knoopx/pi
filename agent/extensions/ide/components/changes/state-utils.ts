import type { ChangesState } from "./state";
import type { Change } from "../../types";

export function getSelectedChanges(state: ChangesState): Change[] {
  if (state.selectedChangeIds.size > 0)
    return state.changes.filter((c) => state.selectedChangeIds.has(c.changeId));
  return state.selectedChange ? [state.selectedChange] : [];
}
