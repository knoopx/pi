/**
 * Graph layout calculation for commit tree visualization
 * Based on serie/kaospilot approach for jj commit graphs
 */

import { getChangeIcon } from "./change-utils";

export interface GraphNode {
  id: string;
  parentIds: string[];
  isWorkingCopy: boolean;
}

interface GraphPosition {
  x: number;
  y: number;
}

export enum EdgeType {
  Vertical = "vertical",
  Horizontal = "horizontal",
  RightDown = "rightDown", // ╮
  LeftDown = "leftDown", // ╭
  RightUp = "rightUp", // ╯
  LeftUp = "leftUp", // ╰
}

export interface Edge {
  type: EdgeType;
  posX: number;
  colorIndex: number;
  /** For commit edges, whether this commit has a parent below */
  hasParentBelow?: boolean;
}

export interface GraphLayout {
  positions: Map<string, GraphPosition>;
  edges: Edge[][];
  maxX: number;
}

/**
 * Calculate graph layout for a list of commits
 * Commits are expected in topological order (children before parents)
 */
export function calculateGraphLayout(nodes: GraphNode[]): GraphLayout {
  const positions = new Map<string, GraphPosition>();
  const edges: Edge[][] = [];
  let maxX = 0;

  // Track which "lanes" are occupied by which commit ID
  const lanes: (string | null)[] = [];

  for (let y = 0; y < nodes.length; y++) {
    const node = nodes[y];
    const rowEdges: Edge[] = [];

    // Find lanes that have this node as their target (children pointing to this node)
    const childLanes = findChildLanes(node.id, lanes);

    let x: number;
    if (childLanes.length > 0) {
      // Reuse leftmost child's lane
      x = Math.min(...childLanes);
      // Clear other child lanes and add merge-in edges
      for (const lane of childLanes) {
        if (lane !== x) {
          // Add merge-in edge from this lane to the commit lane
          if (lane > x) {
            // Lane merges in from the right: ╯─
            rowEdges.push({
              type: EdgeType.RightUp,
              posX: lane,
              colorIndex: lane % 8,
            });
            for (let mx = x + 1; mx < lane; mx++) {
              rowEdges.push({
                type: EdgeType.Horizontal,
                posX: mx,
                colorIndex: lane % 8,
              });
            }
          } else {
            // Lane merges in from the left: ─╰
            rowEdges.push({
              type: EdgeType.LeftUp,
              posX: lane,
              colorIndex: lane % 8,
            });
            for (let mx = lane + 1; mx < x; mx++) {
              rowEdges.push({
                type: EdgeType.Horizontal,
                posX: mx,
                colorIndex: lane % 8,
              });
            }
          }
          lanes[lane] = null;
        }
      }
      lanes[x] = node.id;
    } else {
      // New commit - find first vacant lane
      x = lanes.findIndex((l) => l === null);
      if (x === -1) {
        x = lanes.length;
        lanes.push(node.id);
      } else {
        lanes[x] = node.id;
      }
    }

    positions.set(node.id, { x, y });
    maxX = Math.max(maxX, x);

    // Add vertical edges for all active lanes (except current commit position)
    for (let laneX = 0; laneX < lanes.length; laneX++) {
      if (lanes[laneX] !== null && laneX !== x) {
        rowEdges.push({
          type: EdgeType.Vertical,
          posX: laneX,
          colorIndex: laneX % 8,
        });
      }
    }

    // The commit circle is at position x
    // Track if this commit has a parent that will appear below
    const hasParentBelow = node.parentIds.length > 0;
    rowEdges.push({
      type: EdgeType.Vertical,
      posX: x,
      colorIndex: x % 8,
      hasParentBelow,
    });

    // Handle merge edges (multiple parents)
    if (node.parentIds.length > 1) {
      for (let i = 1; i < node.parentIds.length; i++) {
        const parentId = node.parentIds[i];
        // Find or create lane for parent
        let parentLane = lanes.findIndex((l) => l === parentId);
        if (parentLane === -1) {
          parentLane = lanes.findIndex((l) => l === null);
          if (parentLane === -1) {
            parentLane = lanes.length;
            lanes.push(parentId);
          } else {
            lanes[parentLane] = parentId;
          }
        }
        maxX = Math.max(maxX, parentLane);

        // Add merge edges - branch going from commit to parent lane
        // On this row, we just show the branch starting; the vertical
        // continuation happens on subsequent rows automatically via lanes
        if (parentLane > x) {
          // Branch goes right: show ─╮ after commit
          rowEdges.push({
            type: EdgeType.RightDown,
            posX: x,
            colorIndex: parentLane % 8,
          });
          for (let mx = x + 1; mx < parentLane; mx++) {
            rowEdges.push({
              type: EdgeType.Horizontal,
              posX: mx,
              colorIndex: parentLane % 8,
            });
          }
          // At the destination lane, start a vertical (not a corner)
          // The corner will be drawn when this branch merges back
          rowEdges.push({
            type: EdgeType.RightDown,
            posX: parentLane,
            colorIndex: parentLane % 8,
          });
        } else if (parentLane < x) {
          // Branch goes left: show ╭─ before commit
          rowEdges.push({
            type: EdgeType.LeftDown,
            posX: x,
            colorIndex: parentLane % 8,
          });
          for (let mx = parentLane + 1; mx < x; mx++) {
            rowEdges.push({
              type: EdgeType.Horizontal,
              posX: mx,
              colorIndex: parentLane % 8,
            });
          }
          rowEdges.push({
            type: EdgeType.LeftDown,
            posX: parentLane,
            colorIndex: parentLane % 8,
          });
        }
      }
    }

    // Update lane for first parent
    if (node.parentIds.length > 0) {
      lanes[x] = node.parentIds[0]!;
    } else {
      lanes[x] = null; // Root commit
    }

    edges.push(rowEdges);
  }

  return { positions, edges, maxX };
}

function findChildLanes(nodeId: string, lanes: (string | null)[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === nodeId) {
      result.push(i);
    }
  }
  return result;
}

/** Graph characters for text rendering */
const GRAPH_CHARS = {
  vertical: "│",
  horizontal: "─",
  rightDown: "╮",
  leftDown: "╭",
  rightUp: "╯",
  leftUp: "╰",
  space: " ",
};

/**
 * Render a graph row as text
 * Returns a string representing the graph portion of the row
 */
export function renderGraphRow(
  edges: Edge[],
  commitX: number,
  isWorkingCopy: boolean,
  isEmpty: boolean,
  _maxX: number,
): string {
  // Find the actual rightmost edge position for this row (not global maxX)
  const actualMaxX = edges.reduce((max, e) => Math.max(max, e.posX), 0);

  // Each column is 2 chars wide (char + space), but trim trailing space
  const width = actualMaxX * 2 + 1;
  const chars: string[] = new Array(width).fill(" ");

  // Group edges by position to handle overlaps
  const edgesByPos = new Map<number, Edge[]>();
  for (const edge of edges) {
    const existing = edgesByPos.get(edge.posX) ?? [];
    existing.push(edge);
    edgesByPos.set(edge.posX, existing);
  }

  // Check if there's a branch-out from commit going right
  const hasBranchRight = edges.some(
    (e) => e.posX === commitX && e.type === EdgeType.RightDown,
  );

  // Draw all positions
  for (const [posX, posEdges] of edgesByPos) {
    const pos = posX * 2;
    if (pos >= width) continue;

    if (posX === commitX) {
      // Draw change char
      chars[pos] = getChangeIcon(isWorkingCopy, isEmpty);
      // If branching right, draw horizontal after commit
      if (hasBranchRight && pos + 1 < width) {
        chars[pos + 1] = GRAPH_CHARS.horizontal;
      }
    } else {
      // Determine what to draw based on edge types at this position
      const hasVertical = posEdges.some((e) => e.type === EdgeType.Vertical);
      const hasRightDown = posEdges.some((e) => e.type === EdgeType.RightDown);
      const hasLeftDown = posEdges.some((e) => e.type === EdgeType.LeftDown);
      const hasRightUp = posEdges.some((e) => e.type === EdgeType.RightUp);
      const hasLeftUp = posEdges.some((e) => e.type === EdgeType.LeftUp);
      const hasHorizontal = posEdges.some(
        (e) => e.type === EdgeType.Horizontal,
      );

      // Handle combined cases
      if (hasRightUp && hasRightDown) {
        // Both merge-in and branch-out: use ┤ or just │
        chars[pos] = "├";
      } else if (hasLeftUp && hasLeftDown) {
        chars[pos] = "┤";
      } else if (hasVertical) {
        chars[pos] = GRAPH_CHARS.vertical;
      } else if (hasRightDown) {
        chars[pos] = GRAPH_CHARS.rightDown;
      } else if (hasLeftDown) {
        chars[pos] = GRAPH_CHARS.leftDown;
      } else if (hasRightUp) {
        chars[pos] = GRAPH_CHARS.rightUp;
      } else if (hasLeftUp) {
        chars[pos] = GRAPH_CHARS.leftUp;
      } else if (hasHorizontal) {
        chars[pos] = GRAPH_CHARS.horizontal;
        if (pos + 1 < width) chars[pos + 1] = GRAPH_CHARS.horizontal;
      }
    }
  }

  return chars.join("");
}
