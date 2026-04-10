import { describe, it, expect } from "vitest";
import {
  calculateGraphLayout,
  renderGraphRow,
  EdgeType,
  type GraphNode,
  type Edge,
  type GraphLayout,
} from "./graph";

// Helper to render graph rows from a layout
function renderGraphRows(nodes: GraphNode[], layout: GraphLayout): string[] {
  return nodes.map((node, i) => {
    const pos = layout.positions.get(node.id)!;
    return renderGraphRow(
      layout.edges[i],
      pos.x,
      node.isWorkingCopy,
      false,
      layout.maxX,
    );
  });
}

// Shared test fixtures
const simpleMergeNodes: GraphNode[] = [
  { id: "merge", parentIds: ["A", "B"], isWorkingCopy: false },
  { id: "A", parentIds: ["root"], isWorkingCopy: false },
  { id: "B", parentIds: ["root"], isWorkingCopy: false },
  { id: "root", parentIds: [], isWorkingCopy: false },
];

describe("graph", () => {
  describe("calculateGraphLayout", () => {
    describe("given empty nodes list", () => {
      describe("when calculating layout", () => {
        it("then returns empty layout", () => {
          const result = calculateGraphLayout([]);

          expect(result.positions.size).toBe(0);
          expect(result.edges).toEqual([]);
          expect(result.maxX).toBe(0);
        });
      });
    });

    describe("given single root commit", () => {
      const nodes: GraphNode[] = [
        { id: "root", parentIds: [], isWorkingCopy: false },
      ];

      describe("when calculating layout", () => {
        const result = calculateGraphLayout(nodes);

        it("then places commit at position (0, 0)", () => {
          expect(result.positions.get("root")).toEqual({ x: 0, y: 0 });
        });

        it("then creates one row of edges", () => {
          expect(result.edges.length).toBe(1);
        });

        it("then marks commit as having no parent below", () => {
          const commitEdge = result.edges[0].find(
            (e) => e.posX === 0 && e.type === EdgeType.Vertical,
          );
          expect(commitEdge?.hasParentBelow).toBe(false);
        });

        it("then has maxX of 0", () => {
          expect(result.maxX).toBe(0);
        });
      });
    });

    describe("given linear chain of commits", () => {
      const nodes: GraphNode[] = [
        { id: "C", parentIds: ["B"], isWorkingCopy: false },
        { id: "B", parentIds: ["A"], isWorkingCopy: false },
        { id: "A", parentIds: [], isWorkingCopy: false },
      ];

      describe("when calculating layout", () => {
        const result = calculateGraphLayout(nodes);

        it("then places all commits in lane 0", () => {
          expect(result.positions.get("C")).toEqual({ x: 0, y: 0 });
          expect(result.positions.get("B")).toEqual({ x: 0, y: 1 });
          expect(result.positions.get("A")).toEqual({ x: 0, y: 2 });
        });

        it("then marks first two commits as having parent below", () => {
          const cEdge = result.edges[0].find((e) => e.posX === 0);
          const bEdge = result.edges[1].find((e) => e.posX === 0);
          const aEdge = result.edges[2].find((e) => e.posX === 0);

          expect(cEdge?.hasParentBelow).toBe(true);
          expect(bEdge?.hasParentBelow).toBe(true);
          expect(aEdge?.hasParentBelow).toBe(false);
        });

        it("then has maxX of 0", () => {
          expect(result.maxX).toBe(0);
        });
      });
    });

    describe("given simple merge commit", () => {
      describe("when calculating layout", () => {
        const result = calculateGraphLayout(simpleMergeNodes);

        it("then places merge at lane 0", () => {
          expect(result.positions.get("merge")).toEqual({ x: 0, y: 0 });
        });

        it("then places first parent at lane 0", () => {
          expect(result.positions.get("A")).toEqual({ x: 0, y: 1 });
        });

        it("then places second parent at lane 1", () => {
          expect(result.positions.get("B")).toEqual({ x: 1, y: 2 });
        });

        it("then places root at lane 0 after branches merge", () => {
          expect(result.positions.get("root")).toEqual({ x: 0, y: 3 });
        });

        it("then has maxX of 1", () => {
          expect(result.maxX).toBe(1);
        });

        it("then adds branch-out edges on merge row", () => {
          const mergeEdges = result.edges[0];
          const hasRightDown = mergeEdges.some(
            (e) => e.type === EdgeType.RightDown,
          );
          expect(hasRightDown).toBe(true);
        });

        it("then adds merge-in edge on root row", () => {
          const rootEdges = result.edges[3];
          const hasRightUp = rootEdges.some((e) => e.type === EdgeType.RightUp);
          expect(hasRightUp).toBe(true);
        });
      });
    });

    describe("given multiple children merging into same parent", () => {
      const nodes: GraphNode[] = [
        { id: "C1", parentIds: ["parent"], isWorkingCopy: false },
        { id: "C2", parentIds: ["parent"], isWorkingCopy: false },
        { id: "parent", parentIds: [], isWorkingCopy: false },
      ];

      describe("when calculating layout", () => {
        const result = calculateGraphLayout(nodes);

        it("then places first child at lane 0", () => {
          expect(result.positions.get("C1")).toEqual({ x: 0, y: 0 });
        });

        it("then places second child at lane 1", () => {
          expect(result.positions.get("C2")).toEqual({ x: 1, y: 1 });
        });

        it("then places parent at lane 0", () => {
          expect(result.positions.get("parent")).toEqual({ x: 0, y: 2 });
        });

        it("then adds merge-in edge from lane 1 to parent", () => {
          const parentEdges = result.edges[2];
          const mergeIn = parentEdges.find(
            (e) => e.posX === 1 && e.type === EdgeType.RightUp,
          );
          expect(mergeIn).toBeDefined();
        });
      });
    });

    describe("given working copy node", () => {
      const nodes: GraphNode[] = [
        { id: "wc", parentIds: ["parent"], isWorkingCopy: true },
        { id: "parent", parentIds: [], isWorkingCopy: false },
      ];

      describe("when calculating layout", () => {
        it("then preserves isWorkingCopy flag in node", () => {
          const result = calculateGraphLayout(nodes);
          expect(result.positions.get("wc")).toEqual({ x: 0, y: 0 });
        });
      });
    });

    describe("given lane reuse scenario", () => {
      const nodes: GraphNode[] = [
        { id: "tip", parentIds: ["merge"], isWorkingCopy: false },
        { id: "merge", parentIds: ["A", "B"], isWorkingCopy: false },
        { id: "A", parentIds: ["base"], isWorkingCopy: false },
        { id: "B", parentIds: ["base"], isWorkingCopy: false },
        { id: "base", parentIds: ["deeper"], isWorkingCopy: false },
        { id: "deeper", parentIds: [], isWorkingCopy: false },
      ];

      describe("when calculating layout", () => {
        const result = calculateGraphLayout(nodes);

        it("then reuses lane after merge completes", () => {
          expect(result.positions.get("base")?.x).toBe(0);
          expect(result.positions.get("deeper")?.x).toBe(0);
        });
      });
    });
  });

  describe("renderGraphRow", () => {
    describe("given commit at lane 0 with no other edges", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: true,
        },
      ];

      describe("when rendering non-working-copy commit", () => {
        it("then shows filled diamond for non-empty commit", () => {
          const result = renderGraphRow(edges, 0, false, false, 0);
          expect(result).toBe("◆");
        });

        it("then shows empty circle for empty commit", () => {
          const result = renderGraphRow(edges, 0, false, true, 0);
          expect(result).toBe("○");
        });
      });

      describe("when rendering working copy commit", () => {
        it("then shows ◉ for non-empty working copy", () => {
          const result = renderGraphRow(edges, 0, true, false, 0);
          expect(result).toBe("◉");
        });

        it("then shows ◎ for empty working copy", () => {
          const result = renderGraphRow(edges, 0, true, true, 0);
          expect(result).toBe("◎");
        });
      });
    });

    describe("given commit with vertical continuation in another lane", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: true,
        },
        { type: EdgeType.Vertical, posX: 1, colorIndex: 1 },
      ];

      describe("when rendering", () => {
        it("then shows commit and vertical line", () => {
          const result = renderGraphRow(edges, 0, false, false, 1);
          expect(result).toBe("◆ │");
        });
      });
    });

    describe("given commit in lane 1 with vertical in lane 0", () => {
      const edges: Edge[] = [
        { type: EdgeType.Vertical, posX: 0, colorIndex: 0 },
        {
          type: EdgeType.Vertical,
          posX: 1,
          colorIndex: 1,
          hasParentBelow: true,
        },
      ];

      describe("when rendering", () => {
        it("then shows vertical then commit", () => {
          const result = renderGraphRow(edges, 1, false, false, 1);
          expect(result).toBe("│ ◆");
        });
      });
    });

    describe("given branch-out edge (RightDown)", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: true,
        },
        { type: EdgeType.RightDown, posX: 0, colorIndex: 1 },
        { type: EdgeType.RightDown, posX: 1, colorIndex: 1 },
      ];

      describe("when rendering", () => {
        it("then shows commit with branch going right", () => {
          const result = renderGraphRow(edges, 0, false, false, 1);
          expect(result).toBe("◆─╮");
        });
      });
    });

    describe("given merge-in edge (RightUp)", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: false,
        },
        { type: EdgeType.RightUp, posX: 1, colorIndex: 1 },
      ];

      describe("when rendering", () => {
        it("then shows commit with merge from right", () => {
          const result = renderGraphRow(edges, 0, false, false, 1);
          expect(result).toBe("◆ ╯");
        });
      });
    });

    describe("given combined merge-in and branch-out at same position", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: true,
        },
        { type: EdgeType.RightUp, posX: 1, colorIndex: 1 },
        { type: EdgeType.RightDown, posX: 0, colorIndex: 2 },
        { type: EdgeType.RightDown, posX: 1, colorIndex: 2 },
      ];

      describe("when rendering", () => {
        it("then shows combined character ├", () => {
          const result = renderGraphRow(edges, 0, false, false, 1);
          expect(result).toBe("◆─├");
        });
      });
    });

    describe("given horizontal connecting edges", () => {
      const edges: Edge[] = [
        {
          type: EdgeType.Vertical,
          posX: 0,
          colorIndex: 0,
          hasParentBelow: true,
        },
        { type: EdgeType.RightDown, posX: 0, colorIndex: 2 },
        { type: EdgeType.Horizontal, posX: 1, colorIndex: 2 },
        { type: EdgeType.RightDown, posX: 2, colorIndex: 2 },
      ];

      describe("when rendering", () => {
        it("then shows horizontal line connecting branches", () => {
          const result = renderGraphRow(edges, 0, false, false, 2);
          expect(result).toBe("◆───╮");
        });
      });
    });

    describe("given dynamic width calculation", () => {
      describe("when edges only use lane 0", () => {
        const edges: Edge[] = [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
        ];

        it("then renders minimal width", () => {
          const result = renderGraphRow(edges, 0, false, false, 5);
          expect(result).toBe("◆");
          expect(result.length).toBe(1);
        });
      });

      describe("when edges use lanes 0 and 2", () => {
        const edges: Edge[] = [
          {
            type: EdgeType.Vertical,
            posX: 0,
            colorIndex: 0,
            hasParentBelow: true,
          },
          { type: EdgeType.Vertical, posX: 2, colorIndex: 2 },
        ];

        it("then renders width to include lane 2", () => {
          const result = renderGraphRow(edges, 0, false, false, 5);
          expect(result).toBe("◆   │");
          expect(result.length).toBe(5);
        });
      });
    });

    describe("given LeftDown edge (branch going left)", () => {
      const edges: Edge[] = [
        { type: EdgeType.LeftDown, posX: 0, colorIndex: 0 },
        {
          type: EdgeType.Vertical,
          posX: 1,
          colorIndex: 1,
          hasParentBelow: true,
        },
      ];

      describe("when rendering", () => {
        it("then shows left-down corner", () => {
          const result = renderGraphRow(edges, 1, false, false, 1);
          expect(result).toBe("╭ ◆");
        });
      });
    });

    describe("given LeftUp edge (merge from left)", () => {
      const edges: Edge[] = [
        { type: EdgeType.LeftUp, posX: 0, colorIndex: 0 },
        {
          type: EdgeType.Vertical,
          posX: 1,
          colorIndex: 1,
          hasParentBelow: false,
        },
      ];

      describe("when rendering", () => {
        it("then shows left-up corner", () => {
          const result = renderGraphRow(edges, 1, false, false, 1);
          expect(result).toBe("╰ ◆");
        });
      });
    });

    describe("given combined LeftUp and LeftDown at same position", () => {
      const edges: Edge[] = [
        { type: EdgeType.LeftUp, posX: 0, colorIndex: 0 },
        { type: EdgeType.LeftDown, posX: 0, colorIndex: 1 },
        {
          type: EdgeType.Vertical,
          posX: 1,
          colorIndex: 1,
          hasParentBelow: true,
        },
      ];

      describe("when rendering", () => {
        it("then shows combined character ┤", () => {
          const result = renderGraphRow(edges, 1, false, false, 1);
          expect(result).toBe("┤ ◆");
        });
      });
    });
  });

  describe("integration: calculateGraphLayout + renderGraphRow", () => {
    describe("given simple merge scenario", () => {
      describe("when rendering complete graph", () => {
        const layout = calculateGraphLayout(simpleMergeNodes);

        it("then produces expected visual output", () => {
          const rows = renderGraphRows(simpleMergeNodes, layout);

          expect(rows[0]).toBe("◆─╮"); // merge with branch
          expect(rows[1]).toBe("◆ │"); // A with lane 1 continuing
          expect(rows[2]).toBe("│ ◆"); // B at lane 1
          expect(rows[3]).toBe("◆ ╯"); // root with merge-in
        });
      });
    });

    describe("given working copy with parent", () => {
      const nodes: GraphNode[] = [
        { id: "wc", parentIds: ["parent"], isWorkingCopy: true },
        { id: "parent", parentIds: [], isWorkingCopy: false },
      ];

      describe("when rendering", () => {
        const layout = calculateGraphLayout(nodes);

        it("then shows working copy indicator", () => {
          const wcRow = renderGraphRow(
            layout.edges[0],
            layout.positions.get("wc")!.x,
            true,
            false,
            layout.maxX,
          );
          expect(wcRow).toBe("◉");
        });
      });
    });

    describe("given complex multi-branch scenario", () => {
      const nodes: GraphNode[] = [
        { id: "head", parentIds: ["m1"], isWorkingCopy: true },
        { id: "m1", parentIds: ["a", "b"], isWorkingCopy: false },
        { id: "a", parentIds: ["base"], isWorkingCopy: false },
        { id: "b", parentIds: ["base"], isWorkingCopy: false },
        { id: "base", parentIds: [], isWorkingCopy: false },
      ];

      describe("when rendering", () => {
        const layout = calculateGraphLayout(nodes);

        it("then all commits are positioned correctly", () => {
          expect(layout.positions.get("head")).toEqual({ x: 0, y: 0 });
          expect(layout.positions.get("m1")).toEqual({ x: 0, y: 1 });
          expect(layout.positions.get("a")).toEqual({ x: 0, y: 2 });
          expect(layout.positions.get("b")).toEqual({ x: 1, y: 3 });
          expect(layout.positions.get("base")).toEqual({ x: 0, y: 4 });
        });

        it("then renders coherent graph", () => {
          const rows = renderGraphRows(nodes, layout);

          expect(rows[0]).toBe("◉"); // head (working copy)
          expect(rows[1]).toBe("◆─╮"); // m1 with branch
          expect(rows[2]).toBe("◆ │"); // a with lane 1
          expect(rows[3]).toBe("│ ◆"); // b at lane 1
          expect(rows[4]).toBe("◆ ╯"); // base with merge-in
        });
      });
    });
  });
});
