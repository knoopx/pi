/**
 * Graph layout calculation for commit tree visualization
 * Based on serie/kaospilot approach for jj commit graphs
 */

import { getChangeIcon } from "./changes/formatting";

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
 * Find all lanes that contain a specific node ID
 */
function findChildLanes(nodeId: string, lanes: (string | null)[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === nodeId) result.push(i);
  }
  return result;
}

/**
 * Add edges for merging from a non-target lane
 */
function addMergeLaneEdges(
  lane: number,
  targetX: number,
  rowEdges: Edge[],
): void {
  if (lane > targetX) {
    rowEdges.push({ type: EdgeType.RightUp, posX: lane, colorIndex: lane % 8 });
    for (let mx = targetX + 1; mx < lane; mx++) {
      rowEdges.push({
        type: EdgeType.Horizontal,
        posX: mx,
        colorIndex: lane % 8,
      });
    }
  } else {
    rowEdges.push({ type: EdgeType.LeftUp, posX: lane, colorIndex: lane % 8 });
    for (let mx = lane + 1; mx < targetX; mx++) {
      rowEdges.push({
        type: EdgeType.Horizontal,
        posX: mx,
        colorIndex: lane % 8,
      });
    }
  }
}

/**
 * Process child lanes when a commit merges from multiple branches
 */
function processChildLanes(
  node: GraphNode,
  lanes: (string | null)[],
  rowEdges: Edge[],
): number {
  const childLanes = findChildLanes(node.id, lanes);
  const x = Math.min(...childLanes);

  for (const lane of childLanes) {
    if (lane === x) continue;
    addMergeLaneEdges(lane, x, rowEdges);
    lanes[lane] = null;
  }
  lanes[x] = node.id;
  return x;
}

/**
 * Find or create a lane for a new commit
 */
function findOrCreateLane(nodeId: string, lanes: (string | null)[]): number {
  const existingNull = lanes.findIndex((l) => l === null);
  if (existingNull !== -1) {
    lanes[existingNull] = nodeId;
    return existingNull;
  }
  lanes.push(nodeId);
  return lanes.length - 1;
}

/**
 * Add vertical edges for all active lanes except the commit position
 */
function addVerticalEdges(
  lanes: (string | null)[],
  commitX: number,
  rowEdges: Edge[],
) {
  for (let laneX = 0; laneX < lanes.length; laneX++) {
    if (lanes[laneX] !== null && laneX !== commitX)
      rowEdges.push({
        type: EdgeType.Vertical,
        posX: laneX,
        colorIndex: laneX % 8,
      });
  }
}

/**
 * Find or create a lane for a parent commit
 */
function findOrCreateParentLane(
  parentId: string,
  lanes: (string | null)[],
): number {
  const existingId = lanes.findIndex((l) => l === parentId);
  if (existingId !== -1) return existingId;

  const existingNull = lanes.findIndex((l) => l === null);
  if (existingNull !== -1) {
    lanes[existingNull] = parentId;
    return existingNull;
  }
  lanes.push(parentId);
  return lanes.length - 1;
}

/**
 * Add branch edges from commit to parent lane (going right)
 */
function addBranchRight(commitX: number, parentLane: number, rowEdges: Edge[]) {
  rowEdges.push({
    type: EdgeType.RightDown,
    posX: commitX,
    colorIndex: parentLane % 8,
  });
  for (let mx = commitX + 1; mx < parentLane; mx++) {
    rowEdges.push({
      type: EdgeType.Horizontal,
      posX: mx,
      colorIndex: parentLane % 8,
    });
  }
  rowEdges.push({
    type: EdgeType.RightDown,
    posX: parentLane,
    colorIndex: parentLane % 8,
  });
}

/**
 * Add branch edges from commit to parent lane (going left)
 */
function addBranchLeft(commitX: number, parentLane: number, rowEdges: Edge[]) {
  rowEdges.push({
    type: EdgeType.LeftDown,
    posX: commitX,
    colorIndex: parentLane % 8,
  });
  for (let mx = parentLane + 1; mx < commitX; mx++) {
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

/**
 * Process merge edges for commits with multiple parents
 */
function processMergeEdges(
  node: GraphNode,
  commitX: number,
  lanes: (string | null)[],
  rowEdges: Edge[],
): number {
  let maxX = commitX;

  for (let i = 1; i < node.parentIds.length; i++) {
    const parentId = node.parentIds[i];
    const parentLane = findOrCreateParentLane(parentId, lanes);
    maxX = Math.max(maxX, parentLane);

    if (parentLane > commitX) addBranchRight(commitX, parentLane, rowEdges);
    else if (parentLane < commitX) addBranchLeft(commitX, parentLane, rowEdges);
  }
  return maxX;
}

/**
 * Calculate graph layout for a list of commits
 * Commits are expected in topological order (children before parents)
 */
export function calculateGraphLayout(nodes: GraphNode[]): GraphLayout {
  const positions = new Map<string, GraphPosition>();
  const edges: Edge[][] = [];
  let maxX = 0;
  const lanes: (string | null)[] = [];

  for (const node of nodes) {
    const rowEdges: Edge[] = [];

    const hasChildren = findChildLanes(node.id, lanes).length > 0;
    const x = hasChildren
      ? processChildLanes(node, lanes, rowEdges)
      : findOrCreateLane(node.id, lanes);

    positions.set(node.id, { x, y: edges.length });
    maxX = Math.max(maxX, x);

    addVerticalEdges(lanes, x, rowEdges);

    rowEdges.push({
      type: EdgeType.Vertical,
      posX: x,
      colorIndex: x % 8,
      hasParentBelow: node.parentIds.length > 0,
    });

    maxX = Math.max(maxX, processMergeEdges(node, x, lanes, rowEdges));

    lanes[x] = node.parentIds.length > 0 ? node.parentIds[0] : null;
    edges.push(rowEdges);
  }

  return { positions, edges, maxX };
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
 * Group edges by position for efficient rendering
 */
function groupEdgesByPos(edges: Edge[]): Map<number, Edge[]> {
  const edgesByPos = new Map<number, Edge[]>();
  for (const edge of edges) {
    const existing = edgesByPos.get(edge.posX) ?? [];
    existing.push(edge);
    edgesByPos.set(edge.posX, existing);
  }
  return edgesByPos;
}

/**
 * Check if there's a branch-out from commit going right
 */
function hasBranchRight(edges: Edge[], commitX: number): boolean {
  return edges.some((e) => e.posX === commitX && e.type === EdgeType.RightDown);
}

/**
 * Get edge type flags for a position
 */
function getEdgeFlags(posEdges: Edge[]): {
  hasVertical: boolean;
  hasRightDown: boolean;
  hasLeftDown: boolean;
  hasRightUp: boolean;
  hasLeftUp: boolean;
  hasHorizontal: boolean;
} {
  return {
    hasVertical: posEdges.some((e) => e.type === EdgeType.Vertical),
    hasRightDown: posEdges.some((e) => e.type === EdgeType.RightDown),
    hasLeftDown: posEdges.some((e) => e.type === EdgeType.LeftDown),
    hasRightUp: posEdges.some((e) => e.type === EdgeType.RightUp),
    hasLeftUp: posEdges.some((e) => e.type === EdgeType.LeftUp),
    hasHorizontal: posEdges.some((e) => e.type === EdgeType.Horizontal),
  };
}

/**
 * Determine the character to draw based on edge types
 */
function getEdgeChar(flags: ReturnType<typeof getEdgeFlags>): string {
  if (flags.hasRightUp && flags.hasRightDown) return "├";
  if (flags.hasLeftUp && flags.hasLeftDown) return "┤";
  if (flags.hasVertical) return GRAPH_CHARS.vertical;
  if (flags.hasRightDown) return GRAPH_CHARS.rightDown;
  if (flags.hasLeftDown) return GRAPH_CHARS.leftDown;
  if (flags.hasRightUp) return GRAPH_CHARS.rightUp;
  if (flags.hasLeftUp) return GRAPH_CHARS.leftUp;
  if (flags.hasHorizontal) return GRAPH_CHARS.horizontal;
  return " ";
}

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
  const actualMaxX = edges.reduce((max, e) => Math.max(max, e.posX), 0);
  const width = actualMaxX * 2 + 1;
  const chars: string[] = new Array(width).fill(" ");
  const edgesByPos = groupEdgesByPos(edges);
  const branchRight = hasBranchRight(edges, commitX);

  for (const [posX, posEdges] of edgesByPos) {
    const pos = posX * 2;
    if (pos >= width) continue;

    if (posX === commitX) {
      chars[pos] = getChangeIcon(isWorkingCopy, isEmpty);
      if (branchRight && pos + 1 < width)
        chars[pos + 1] = GRAPH_CHARS.horizontal;
    } else {
      const flags = getEdgeFlags(posEdges);
      chars[pos] = getEdgeChar(flags);
      if (flags.hasHorizontal && pos + 1 < width)
        chars[pos + 1] = GRAPH_CHARS.horizontal;
    }
  }

  return chars.join("");
}
