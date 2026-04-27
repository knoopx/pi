import type { Node } from "unist";

/**
 * Splice nodes out of their parents in reverse index order so that
 * earlier indices remain valid. Accepts the list produced by a
 * `visit` callback that collects `{ parent, index }` pairs.
 */
export function removeNodesByIndex(
  removals: Array<{ parent: Node; index: number }>,
): void {
  for (let i = removals.length - 1; i >= 0; i -= 1) {
    const { parent, index } = removals[i];
    const siblings = (parent as { children?: Node[] }).children;
    if (siblings) {
      siblings.splice(index, 1);
    }
  }
}
