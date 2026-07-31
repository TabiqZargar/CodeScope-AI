/**
 * Smoke tests for the debugger layer (timeline intelligence).
 *
 * Covers snapshot classification, diffing, search, navigation/playback math,
 * keyboard mapping, and large-timeline behaviour. All pure functions — no DOM
 * and no React, so it runs headless.
 *
 * Run with:  npm run test:debugger
 */
import { runCode } from "../src/engine/index";
import type { ExecutionResult, Snapshot } from "../src/engine/index";
import {
  PLAYBACK_BASE_MS,
  PLAYBACK_SPEEDS,
  applyKeyAction,
  buildSearchIndex,
  canStep,
  clampIndex,
  classifySnapshot,
  classifyTimeline,
  computeDiff,
  firstIndex,
  lastIndex,
  playbackDelayMs,
  resolveKeyAction,
  searchTimeline,
  snapshotSearchText,
  stepIndex,
  toggleSetItem,
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

function snapshotsOf(code: string): readonly Snapshot[] {
  const result: ExecutionResult = runCode(code);
  check(`execution succeeds: ${code.split("\n")[0]}`, result.ok, result);
  return result.snapshots;
}

console.log("1) navigation math");
{
  check("PLAYBACK_SPEEDS is [0.25, 0.5, 1, 2, 4, 8]", PLAYBACK_SPEEDS.join(",") === "0.25,0.5,1,2,4,8");
  check("playbackDelayMs(1) === base", playbackDelayMs(1) === PLAYBACK_BASE_MS);
  check("playbackDelayMs(0.25) === 4000", playbackDelayMs(0.25) === 4000);
  check("playbackDelayMs(8) === 125", playbackDelayMs(8) === 125);

  check("clampIndex(0, 0) === 0", clampIndex(0, 0) === 0);
  check("clampIndex(-5, 10) === 0", clampIndex(-5, 10) === 0);
  check("clampIndex(99, 10) === 9", clampIndex(99, 10) === 9);
  check("clampIndex(4, 10) === 4", clampIndex(4, 10) === 4);

  check("stepIndex clamps low", stepIndex(2, -10, 5) === 0);
  check("stepIndex clamps high", stepIndex(2, 10, 5) === 4);
  check("stepIndex steps", stepIndex(2, 1, 5) === 3);

  check("firstIndex() === 0", firstIndex() === 0);
  check("lastIndex(0) === 0", lastIndex(0) === 0);
  check("lastIndex(5) === 4", lastIndex(5) === 4);

  check("canStep forward", canStep(0, 1, 3));
  check("canStep not forward at end", !canStep(2, 1, 3));
  check("canStep backward", canStep(2, -1, 3));
  check("canStep not backward at start", !canStep(0, -1, 3));

  const base = new Set([1, 2]);
  const next = toggleSetItem(base, 3);
  check("toggleSetItem adds", next.has(3) && next.size === 3);
  check("toggleSetItem removes", toggleSetItem(next, 3).size === 2);
  check("toggleSetItem is immutable", base.size === 2 && !base.has(3));
}

console.log("2) keyboard mapping");
{
  const skipLeft = resolveKeyAction("ArrowLeft", true);
  const skipRight = resolveKeyAction("ArrowRight", true);
  check("Shift+ArrowLeft skips -10", skipLeft.type === "step" && skipLeft.delta === -10);
  check("Shift+ArrowRight skips +10", skipRight.type === "step" && skipRight.delta === 10);
  check("plain ArrowLeft is none (owned by visualizer)", resolveKeyAction("ArrowLeft", false).type === "none");
  check("plain ArrowRight is none (owned by visualizer)", resolveKeyAction("ArrowRight", false).type === "none");
  check("Home jumps first", resolveKeyAction("Home", false).type === "jump-first");
  check("End jumps last", resolveKeyAction("End", false).type === "jump-last");
  check("Space toggles play", resolveKeyAction(" ", false).type === "toggle-play");
  check("b toggles bookmark", resolveKeyAction("b", false).type === "toggle-bookmark");
  check("unknown key is none", resolveKeyAction("q", false).type === "none");

  const jump = resolveKeyAction("End", false);
  check("applyKeyAction(End, 2, 5) === 4", applyKeyAction(jump, 2, 5) === 4);
  const skip = resolveKeyAction("ArrowRight", true);
  check("applyKeyAction(Shift+Right, 5, 100) === 15", applyKeyAction(skip, 5, 100) === 15);
  check("applyKeyAction(none) unchanged", applyKeyAction({ type: "none" }, 7, 100) === 7);
}

console.log("3) snapshot classification");
{
  const snapshots = snapshotsOf(`
let x = 0;
for (let i = 0; i < 3; i++) {
  x = x + i;
  console.log(x);
}
if (x > 0) {
  console.log("done");
}
x = 99;
`);
  const types = classifyTimeline(snapshots);
  check("one type per snapshot", types.length === snapshots.length);

  const has = (t: string) => types.some((kind) => kind === t);
  check("contains declaration", has("declaration"), types);
  check("contains loop", has("loop"), types);
  check("contains console", has("console"), types);
  check("contains condition", has("condition"), types);
  check("contains assignment", has("assignment"), types);

  // Determinism: classifying again yields the same sequence.
  check(
    "classification is deterministic",
    classifyTimeline(snapshots).every((kind, i) => kind === types[i]),
  );

  // Regression: an initial snapshot is "other".
  const declared = snapshotsOf("let a = 1;")[1];
  check("declaration type for 'let a = 1'", classifySnapshot(declared, undefined) === "declaration");

  const cons = snapshotsOf("console.log('hi');");
  check(
    "console type for console.log step",
    classifySnapshot(cons[cons.length - 1], cons[cons.length - 2]) === "console",
  );
}

console.log("4) diffing");
{
  const snapshots = snapshotsOf("let a = 1;\nlet b = 2;\na = a + 1;");
  check("at least 4 snapshots", snapshots.length >= 4);

  const declaredA = computeDiff(undefined, snapshots[1]);
  check("first declaration: a added", declaredA.addedVariables.join(",") === "a");
  check("first declaration: consoleAdded is empty", declaredA.consoleAdded.length === 0);

  const declaredB = computeDiff(snapshots[1], snapshots[2]);
  check("second declaration: b added", declaredB.addedVariables.join(",") === "b");

  const assigned = computeDiff(snapshots[2], snapshots[3]);
  check("assignment: a changed", assigned.changedVariables.map((c) => c.name).join(",") === "a");
  check(
    "assignment: before 1 after 2",
    assigned.changedVariables[0]?.before === 1 && assigned.changedVariables[0]?.after === 2,
  );

  const reversed = computeDiff(snapshots[3], snapshots[2]);
  check(
    "diff works backward (a reads as changed)",
    reversed.changedVariables.map((c) => c.name).join(",") === "a",
  );

  const program = snapshotsOf(`
const arr = [];
arr.push(10);
arr.push(20);
console.log(arr.length);
`);
  const last = program[program.length - 1];
  const beforeLast = program[program.length - 2];
  const diff = computeDiff(beforeLast, last);
  check("console diff finds last line", diff.consoleAdded.join(" ") === "2", diff.consoleAdded);
  check("no variable diff for console step", diff.addedVariables.length === 0);
  check("heap unchanged across console step", diff.heapChanged.length === 0 && diff.heapAdded.length === 0);

  const pushed = computeDiff(program[1], program[2]);
  check("arr.push after creation: node already exists (changed, not added)", pushed.heapChanged.length === 1, pushed);
  const created = computeDiff(program[0], program[1]);
  check("declaration added a heap node", created.heapAdded.join(",") === "ref_1", created);
}

console.log("5) call-stack diffing");
{
  const snapshots = snapshotsOf(`
function add(a, b) {
  return a + b;
}
add(2, 3);
`);
  const types = classifyTimeline(snapshots);
  check("contains call type", types.includes("call"), types);
  check("contains return type", types.includes("return"), types);

  let sawPush = false;
  let sawPop = false;
  for (let i = 1; i < snapshots.length; i += 1) {
    const d = computeDiff(snapshots[i - 1], snapshots[i]);
    if (d.framesAdded > 0) sawPush = true;
    if (d.framesRemoved > 0) sawPop = true;
  }
  check("detected a frame push", sawPush);
  check("detected a frame pop", sawPop);
}

console.log("6) search");
{
  const snapshots = snapshotsOf("let x = 42;\nlet y = x * 2;\nconsole.log(x + y);");
  const index = buildSearchIndex(snapshots);

  check("searchIndex parallel to snapshots", index.length === snapshots.length);
  check("snapshotSearchText is lowercase", snapshotSearchText(snapshots[1]) === snapshotSearchText(snapshots[1]).toLowerCase());

  check("empty query matches nothing", searchTimeline(index, "").size === 0);
  check("whitespace query matches nothing", searchTimeline(index, "   ").size === 0);

  const xMatches = searchTimeline(index, "x");
  check("'x' matches every snapshot (declared in all)", xMatches.size === snapshots.length, [...xMatches]);

  const descriptionMatches = searchTimeline(index, "declared");
  check("'declared' matches the declaration snapshots only", descriptionMatches.size === 2, [...descriptionMatches]);

  const andMatches = searchTimeline(index, "declared x");
  check(
    "AND search narrows to declaration steps",
    andMatches.size === 2 && andMatches.has(1) && andMatches.has(2),
    [...andMatches],
  );

  const none = searchTimeline(index, "zzz-nope");
  check("no match is empty", none.size === 0);

  const consoleHit = searchTimeline(index, "126");
  check("search finds console output", consoleHit.size >= 1, [...consoleHit]);
}

console.log("7) large timeline behaviour");
{
  // Synthetic timeline: 10 000 snapshots, alternating descriptions.
  const snapshots: Snapshot[] = new Array(10_000);
  for (let i = 0; i < snapshots.length; i += 1) {
    snapshots[i] = {
      index: i,
      line: (i % 4) + 1,
      variables: i % 2 === 0 ? { total: i } : { total: i, label: `step-${i}` },
      console: i % 10 === 0 ? [`log ${i}`] : [],
      description: i % 2 === 0 ? `Declared total` : `Assigned label`,
      condition: i === 5000 ? "total > 100" : undefined,
      conditionResult: i === 5000 ? true : undefined,
    };
  }

  const started = Date.now();
  const types = classifyTimeline(snapshots);
  const index = buildSearchIndex(snapshots);
  const matches = searchTimeline(index, "label");
  const elapsed = Date.now() - started;

  check("classifies all 10k", types.length === 10_000);
  check("indexes all 10k", index.length === 10_000);
  check("search finds every other step", matches.size === 5000, matches.size);
  check("search is fast (< 500ms total)", elapsed < 500, `${elapsed}ms`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
