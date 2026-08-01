/**
 * Smoke tests for the execution graph (pure graph layer + layout).
 *
 * Covers node generation, edge generation, branching, loops, function calls,
 * selection sync, filtering, overlays, large graphs and dagre layout. All
 * pure — no DOM — so it runs headless.
 *
 * Run with:  npm run test:graph
 */
import { runCode } from "../src/engine/index";
import type { ExecutionResult, Snapshot } from "../src/engine/index";
import {
  ERROR_NODE_ID,
  buildExecutionGraph,
  filterExecutionGraph,
  graphSelection,
  isGraphEdgeOnPath,
  isGraphNodeOnPath,
  layoutExecutionGraph,
  nodeIdFor,
  overlayGraph,
} from "../src/debugger/index";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}`);
    if (detail !== undefined) console.error(`      ${JSON.stringify(detail)}`);
  }
}

function run(code: string): ExecutionResult {
  return runCode(code);
}

function graphOf(code: string) {
  const result = run(code);
  return { graph: buildExecutionGraph(result.snapshots, result.ok ? undefined : result.error), result };
}

function syntheticSnapshots(count: number): Snapshot[] {
  const snapshots: Snapshot[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const inLoop = i % 5 === 2;
    snapshots[i] = {
      index: i,
      line: (i % 4) + 1,
      variables: i % 2 === 0 ? { total: i } : { total: i, label: `step-${i}` },
      console: i % 10 === 0 ? [`log ${i}`] : [],
      description:
        i % 5 === 0 ? `Declared total` : i % 5 === 1 ? `Assigned total` : `Executed step`,
      condition: inLoop ? "total > 100" : undefined,
      conditionResult: inLoop ? true : undefined,
      loopType: inLoop ? "for" : undefined,
      iteration: inLoop ? (i % 5) + 1 : undefined,
    };
  }
  return snapshots;
}

console.log("1) node generation");
{
  const result = run("let a = 1;\nlet b = a + 1;\nconsole.log(b);");
  const graph = buildExecutionGraph(result.snapshots);
  check("one node per snapshot", graph.nodeCount === graph.snapshots.length);
  check("node ids are step-N", graph.nodes.every((n) => n.id === nodeIdFor(n.snapshotIndex)));

  const first = graph.nodes[1];
  check("node carries step number", first.step === 2, first.step);
  check("node carries line number", first.line > 0, first.line);
  check("node carries description", first.description.includes("Declared"), first.description);
  check("no error node without an error", !graph.hasError);
  check("graph shares the snapshots array (no copy)", graph.snapshots === result.snapshots);

  // Initial snapshot is classified (kind 'other') and included.
  check("initial snapshot is a node", graph.nodes[0].snapshotIndex === 0);
}

console.log("2) error node generation");
{
  const result = run("nope(1);");
  check("program fails", !result.ok);
  const error = result.ok ? undefined : result.error;
  const graph = buildExecutionGraph(result.snapshots, error);
  check("has error", graph.hasError);
  check("error node appended", graph.nodes.length === result.snapshots.length + 1);
  const errorNode = graph.nodes[graph.nodes.length - 1];
  check("error node kind", errorNode.kind === "error");
  check("error node id", errorNode.id === ERROR_NODE_ID);
  check("error node carries message", errorNode.description === error?.message);
  check("error edge labeled", graph.edges[graph.edges.length - 1]?.label === "error");
  check("error edge targets the error node", graph.edges.some((e) => e.toId === ERROR_NODE_ID));
  check("no edge leaves the error node", !graph.edges.some((e) => e.fromId === ERROR_NODE_ID));
}

console.log("3) empty snapshots with error");
{
  const graph = buildExecutionGraph([], { kind: "parse", message: "boom", line: 1 });
  check("only the error node", graph.nodeCount === 1);
  check("no edges", graph.edgeCount === 0);
}

console.log("4) linear edge generation");
{
  const { graph } = graphOf("let a = 1;\nlet b = 2;\nlet c = 3;");
  check("n-1 edges", graph.edgeCount === graph.nodeCount - 1);
  check("all edges sequential", graph.edges.every((e, i) => e.fromIndex === i && e.toIndex === i + 1));
  check("all kinds next", graph.edges.every((e) => e.kind === "next"));
  check("edge ids unique", new Set(graph.edges.map((e) => e.id)).size === graph.edges.length);
}

console.log("5) branching (TRUE / FALSE)");
{
  const { graph } = graphOf(
    "let x = 1;\nif (x > 3) {\n  console.log('big');\n} else if (x > 0) {\n  console.log('mid');\n} else {\n  console.log('small');\n}",
  );
  const branchLabels = graph.edges.filter((e) => e.kind === "branch").map((e) => e.label);
  check("has TRUE branch edge", branchLabels.includes("TRUE"), branchLabels);
  check("has FALSE branch edge", branchLabels.includes("FALSE"), branchLabels);
  check("two branch edges", branchLabels.length === 2, branchLabels);

  const cond = run("let x = 1;\nif (x > 3) { console.log('big'); }\nlet y = 2;");
  const condSnap = cond.snapshots.find((s) => s.condition !== undefined)!;
  const branchEdge = buildExecutionGraph(cond.snapshots).edges.find(
    (e) => e.fromIndex === condSnap.index,
  )!;
  check(
    "branch label matches conditionResult",
    branchEdge.label === (condSnap.conditionResult ? "TRUE" : "FALSE"),
    branchEdge,
  );
}

console.log("6) loops (back-edge + entry)");
{
  const { graph } = graphOf("let sum = 0;\nfor (let i = 0; i < 3; i++) {\n  sum = sum + i;\n}");
  const loopEdges = graph.edges.filter((e) => e.kind === "loop");
  check("has loop back-edges", loopEdges.some((e) => e.label === "loop"), loopEdges);
  check("has loop entry edge", loopEdges.some((e) => e.label === "enter"), loopEdges);
  check("one back-edge per iteration check", loopEdges.filter((e) => e.label === "loop").length === 3);

  const backEdge = loopEdges.find((e) => e.label === "loop");
  const target = graph.nodes.find((n) => n.id === backEdge?.toId);
  check("back-edge targets a loop condition", (target?.iteration ?? 0) >= 2, target);
}

console.log("7) function calls and returns");
{
  const { graph } = graphOf("function add(a, b) {\n  return a + b;\n}\nadd(2, 3);");
  check("has call edge", graph.edges.some((e) => e.kind === "call"));
  check("has return edge", graph.edges.some((e) => e.kind === "return"));
  const callEdge = graph.edges.find((e) => e.kind === "call");
  const target = graph.nodes.find((n) => n.id === callEdge?.toId);
  check("call edge targets the entered frame", target?.kind === "call", target);
}

console.log("8) selection sync");
{
  const { graph } = graphOf("let a = 1;\nlet b = 2;\nlet c = 3;\nlet d = 4;\nlet e = 5;\nlet f = 6;");
  check("selection for index 2", graphSelection(graph, 2).has(nodeIdFor(2)));
  check("selection is exactly one node", graphSelection(graph, 2).size === 1);
  check("selection for -1 is empty", graphSelection(graph, -1).size === 0);
  check("selected id maps back to timeline index", graphSelection(graph, 4).has("step-4"));

  const nodes = graph.nodes;
  check(
    "node on path before current",
    isGraphNodeOnPath(nodes[2], 3) && !isGraphNodeOnPath(nodes[4], 3),
  );
  const edge = graph.edges[3];
  check(
    "edge on path when destination executed",
    isGraphEdgeOnPath(edge, 4) && !isGraphEdgeOnPath(graph.edges[4], 4),
  );
}

console.log("9) filtering");
{
  const { graph } = graphOf("let a = 1;\nconsole.log(a);\nlet b = 2;");
  const hiddenConsole = filterExecutionGraph(graph, new Set(["console"]));
  check("console nodes hidden", !hiddenConsole.nodes.some((n) => n.kind === "console"));
  check("edges reconnect", hiddenConsole.edgeCount === hiddenConsole.nodeCount - 1);
  const reconnected = hiddenConsole.edges.find((e) => e.fromIndex === 1 && e.toIndex === 3);
  check("skip edge over hidden node", reconnected !== undefined, hiddenConsole.edges);

  const branchy = graphOf(
    "let x = 1;\nif (x > 3) {\n  console.log('big');\n} else {\n  console.log('small');\n}",
  ).graph;
  const noConditions = filterExecutionGraph(branchy, new Set(["condition"]));
  check("condition nodes hidden", !noConditions.nodes.some((n) => n.kind === "condition"));
  check("no branch edges remain", !noConditions.edges.some((e) => e.kind === "branch"));

  const errors = graphOf("nope(1);").graph;
  const keepOnlyError = filterExecutionGraph(
    errors,
    new Set(["console", "declaration", "assignment", "condition", "loop", "call", "return"]),
  );
  check("error node always survives", keepOnlyError.nodes.some((n) => n.kind === "error"));
  check("error edge reconnected", keepOnlyError.edges.some((e) => e.label === "error"));

  const nothingHidden = filterExecutionGraph(graph, new Set());
  check("empty filter set is a no-op", nothingHidden === graph);
}

console.log("10) overlays (future extensibility)");
{
  const { graph } = graphOf("let a = 1;\nlet b = 2;");
  const layered = overlayGraph(graph, [
    { nodeId: "step-1", kind: "breakpoint", payload: { line: 1 } },
    { nodeId: "step-2", kind: "watch", payload: { expression: "a" } },
    { nodeId: "missing", kind: "ai", payload: { note: "x" } },
  ]);
  const one = layered.nodes.find((n) => n.id === "step-1");
  const two = layered.nodes.find((n) => n.id === "step-2");
  check("overlay attached to matching node", one?.overlays.length === 1);
  const onePayload = one?.overlays[0].payload as { line?: number } | undefined;
  check("overlay payload preserved", onePayload?.line === 1);
  check("multiple overlays on one node", two?.overlays.length === 1);
  check("unknown ids ignored", layered.nodes.every((n) => n.overlays.length <= 1));
  check("no overlays is identity", overlayGraph(graph, []) === graph);
}

console.log("11) graph layout");
{
  const { graph } = graphOf("let a = 1;\nlet b = a + 1;\nlet c = b * 2;\nconsole.log(c);");
  const layout = layoutExecutionGraph(graph);
  check("every node positioned", layout.nodes.length === graph.nodeCount);
  check("positions are finite", layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
  check("layout has bounds", layout.width > 0 && layout.height > 0);

  const layout2 = layoutExecutionGraph(graph);
  check(
    "layout is deterministic",
    JSON.stringify(layout.nodes.map((n) => [n.x, n.y])) ===
      JSON.stringify(layout2.nodes.map((n) => [n.x, n.y])),
  );

  const byIndex = [...layout.nodes].sort((a, b) => a.node.snapshotIndex - b.node.snapshotIndex);
  const descending = byIndex.every((n, i) => i === 0 || byIndex[i - 1].y <= n.y);
  check("top-down ranks are monotonic", descending, byIndex.map((n) => n.y));
}

console.log("12) large graphs (5000+ nodes)");
{
  const snapshots = syntheticSnapshots(5000);
  const started = Date.now();
  const graph = buildExecutionGraph(snapshots);
  const layout = layoutExecutionGraph(graph);
  const elapsed = Date.now() - started;

  check("5000 nodes", graph.nodeCount === 5000);
  check("4999 edges", graph.edgeCount === 4999);
  check("layout covers all nodes", layout.nodes.length === 5000);
  check("layout is fast enough (< 1500ms)", elapsed < 1500, `${elapsed}ms`);
  check("trace layout keeps execution order", layout.nodes.every((n, i) => n.node.snapshotIndex === i));
  check(
    "positions finite",
    layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
