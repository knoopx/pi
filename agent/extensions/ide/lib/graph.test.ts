import { describe, it, expect } from "vitest";
import {
  calculateGraphLayout,
  renderGraphRow,
  EdgeType,
  type Edge,
  type GraphNode,
} from "./graph";

function fullRender(nodes: GraphNode[], isWC: boolean[]): string[] {
  const layout = calculateGraphLayout(nodes);
  return nodes.map((n, i) => {
    const pos = layout.positions.get(n.id);
    if (pos === undefined) return "";
    return renderGraphRow({
      edges: layout.edges[i],
      commitX: pos.x,
      isWorkingCopy: isWC[i] ?? false,
      isEmpty: n.parentIds.length === 0 && !isWC[i],
      maxX: layout.maxX,
    });
  });
}


function node(
  id: string,
  parentIds: string[] = [],
  isWorkingCopy = false,
): GraphNode {
  return { id, parentIds, isWorkingCopy };
}


function mergeTopology(
  tipId: string,
  mergeId: string,
  branchA: string,
  branchB: string,
  baseId: string,
): GraphNode[] {
  return [
    node(tipId, [mergeId], true),
    node(mergeId, [branchA, branchB]),
    node(branchA, [baseId]),
    node(branchB, [baseId]),
    { id: baseId, parentIds: [], isWorkingCopy: false },
  ];
}


function edgeRow(
  edges: Edge[],
  laneX: number,
  maxX: number,
) {
  return renderGraphRow({ edges, commitX: laneX, isWorkingCopy: false, isEmpty: false, maxX });
}


function edge(
  type: EdgeType,
  posX: number,
  colorIndex: number,
  hasParentBelow = false,
) {
  return { type, posX, colorIndex, hasParentBelow };
}

describe("graph", () => {
  it("linear chain renders as single column of icons", () => {
    const nodes: GraphNode[] = [node("C", ["B"]), node("B", ["A"]), node("A")];

    const rows = fullRender(nodes, [false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("working copy at top of linear chain", () => {
    const nodes: GraphNode[] = [
      node("C", ["B"], true),
      node("B", ["A"]),
      node("A"),
    ];

    const rows = fullRender(nodes, [true, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("simple merge (two parents from same root)", () => {
    const nodes: GraphNode[] = [
      node("merge", ["A", "B"]),
      node("A", ["root"]),
      node("B", ["root"]),
      node("root"),
    ];

    const rows = fullRender(nodes, [false, false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("complex multi-branch with working copy", () => {
    const nodes = mergeTopology("head", "m1", "a", "b", "base");
    const rows = fullRender(nodes, [true, false, false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("multiple branches from single commit", () => {
    const nodes: GraphNode[] = [
      node("C1", ["parent"]),
      node("C2", ["parent"]),
      node("C3", ["parent"]),
      { id: "parent", parentIds: [], isWorkingCopy: false },
    ];

    const rows = fullRender(nodes, [false, false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("diamond merge pattern (two branches reconverge)", () => {
    const nodes: GraphNode[] = [
      node("final", ["right"], true),
      node("right", ["shared"]),
      node("left", ["shared"]),
      node("shared"),
    ];

    const rows = fullRender(nodes, [true, false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("empty commit in chain", () => {
    const nodes: GraphNode[] = [
      node("C2", ["C1"]),
      { id: "C1", parentIds: [], isWorkingCopy: false },
    ];

    // C2 is empty (isEmpty=true in fourth param)
    const layout = calculateGraphLayout(nodes);
    const rows = nodes.flatMap((n, i) => {
      const pos = layout.positions.get(n.id);
      if (pos === undefined) return [];
      return [renderGraphRow({ edges: layout.edges[i], commitX: pos.x, isWorkingCopy: false, isEmpty: true, maxX: layout.maxX })];
    });
    expect(rows).toMatchSnapshot();
  });

  it("real-world-like topology with merge and linear history", () => {
    // Simulates a repo where some commits branch off and merge back
    const nodes = mergeTopology("tip", "merge1", "feature", "main", "base");
    const rows = fullRender(nodes, [true, false, false, false, false]);
    expect(rows).toMatchSnapshot();
  });

  it("single root commit", () => {
    const nodes: GraphNode[] = [node("root")];

    const rows = fullRender(nodes, [false]);
    expect(rows).toMatchSnapshot();
  });

  it("empty layout for no nodes", () => {
    const layout = calculateGraphLayout([]);
    expect(layout.positions.size).toBe(0);
    expect(layout.edges).toEqual([]);
    expect(layout.maxX).toBe(0);
  });

  describe("renderGraphRow edge cases", () => {
    it("renders commit-only row at lane 0 with no other edges", () => {
      const result = edgeRow(
        [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
        ],
        0,
        0,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders vertical line alongside commit in another lane", () => {
      const result = edgeRow(
        [
          edge(EdgeType.Vertical, 0, 0),
          edge(EdgeType.Vertical, 1, 1, true),
        ],
        1,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders branch-out with horizontal connector", () => {
      const result = edgeRow(
        [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
          { type: EdgeType.RightDown, posX: 0, colorIndex: 1 },
          { type: EdgeType.Horizontal, posX: 1, colorIndex: 1 },
          { type: EdgeType.RightDown, posX: 2, colorIndex: 1 },
        ],
        0,
        2,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders merge-in from right", () => {
      const result = edgeRow(
        [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: false,
          },
          { type: EdgeType.RightUp, posX: 1, colorIndex: 1 },
        ],
        0,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders combined junction character", () => {
      const result = edgeRow(
        [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
          { type: EdgeType.RightUp, posX: 1, colorIndex: 1 },
          { type: EdgeType.RightDown, posX: 0, colorIndex: 2 },
          { type: EdgeType.RightDown, posX: 1, colorIndex: 2 },
        ],
        0,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders left branch-out (LeftDown)", () => {
      const result = edgeRow(
        [
          edge(EdgeType.LeftDown, 0, 0),
          edge(EdgeType.Vertical, 1, 1, true),
        ],
        1,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders left merge (LeftUp)", () => {
      const result = edgeRow(
        [
          { type: EdgeType.LeftDown, posX: 0, colorIndex: 0 },
          {
            type: EdgeType.Vertical,
            posX: 1,
            colorIndex: 1,
            hasParentBelow: false,
          },
        ],
        1,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("renders combined left junction (┤)", () => {
      const result = edgeRow(
        [
          { type: EdgeType.LeftDown, posX: 0, colorIndex: 0 },
          { type: EdgeType.LeftDown, posX: 0, colorIndex: 1 },
          {
            type: EdgeType.Vertical,
            posX: 1,
            colorIndex: 1,
            hasParentBelow: true,
          },
        ],
        1,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("empty working copy icon", () => {
      const result = renderGraphRow({
        edges: [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
        ],
        commitX: 0,
        isWorkingCopy: true,
        isEmpty: true,
        maxX: 0,
      });
      expect(result).toMatchSnapshot();
    });

    it("non-empty working copy icon", () => {
      const result = renderGraphRow({
        edges: [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
        ],
        commitX: 0,
        isWorkingCopy: true,
        isEmpty: false,
        maxX: 0,
      });
      expect(result).toMatchSnapshot();
    });

    it("empty non-working-copy icon", () => {
      const result = renderGraphRow({
        edges: [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: false,
          },
        ],
        commitX: 0,
        isWorkingCopy: false,
        isEmpty: true,
        maxX: 0,
      });
      expect(result).toMatchSnapshot();
    });
  });

  describe("layout correctness", () => {
    it("linear chain places all at lane 0 with correct y offsets", () => {
      const nodes: GraphNode[] = [
        node("C", ["B"]),
        node("B", ["A"]),
        node("A"),
      ];
      const layout = calculateGraphLayout(nodes);

      expect(layout.positions.get("C")).toEqual({ x: 0, y: 0 });
      expect(layout.positions.get("B")).toEqual({ x: 0, y: 1 });
      expect(layout.positions.get("A")).toEqual({ x: 0, y: 2 });
      expect(layout.maxX).toBe(0);
    });

    it("merge creates separate lanes for divergent parents", () => {
      const nodes: GraphNode[] = [
        node("merge", ["A", "B"]),
        node("A"),
        node("B"),
      ];
      const layout = calculateGraphLayout(nodes);

      expect(layout.positions.get("merge")).toEqual({ x: 0, y: 0 });
      expect(layout.maxX).toBeGreaterThanOrEqual(1);
    });

    it("lane reuse after merge completes", () => {
      const nodes: GraphNode[] = [
        node("tip", ["merge"]),
        node("merge", ["A", "B"]),
        { id: "A", parentIds: ["base"], isWorkingCopy: false },
        { id: "B", parentIds: ["base"], isWorkingCopy: false },
        { id: "base", parentIds: [], isWorkingCopy: false },
      ];
      const layout = calculateGraphLayout(nodes);

      // base should reuse lane 0 after merge branches have been placed
      expect(layout.positions.get("base")?.x).toBe(0);
    });
  });
});
