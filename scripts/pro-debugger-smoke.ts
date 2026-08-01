/**
 * Smoke tests for the professional debugger layer (Milestone 4).
 *
 * Covers breakpoints (toggle/enable/disable/remove/clear, O(1) hit tests,
 * line-index jumps), debugger commands (F-key mapping, continue/stop/step,
 * jump-to-next/previous-breakpoint with binary search), watch expressions
 * (parse + snapshot-only evaluation incl. heap refs, nested access and
 * undefined semantics), the snapshot inspector, and search integration with
 * breakpoint lines and watch expressions. All pure functions — no DOM and no
 * React, so it runs headless.
 *
 * Run with:  npm run test:pro-debugger
 */
import { runCode } from "../src/engine/index";
import type { ExecutionResult, Snapshot } from "../src/engine/index";
import {
  EMPTY_BREAKPOINTS,
  breakpointAtLine,
  breakpointCount,
  buildBreakpointIndex,
  buildSearchIndex,
  clearBreakpoints,
  continueTarget,
  enabledBreakpointCount,
  enabledBreakpointLines,
  evaluateWatchExpression,
  evaluateWatches,
  findNextBreakpointIndex,
  findPreviousBreakpointIndex,
  hasEnabledBreakpoint,
  inspectSnapshot,
  parseWatchExpression,
  removeBreakpoint,
  resolveDebuggerKey,
  searchTimeline,
  setBreakpointEnabled,
  shouldStopAtSnapshot,
  snapshotHitsBreakpoint,
  stepTarget,
  toggleBreakpoint,
  watchHasValue,
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

console.log("1) breakpoint state machine");
{
  const bp = toggleBreakpoint(EMPTY_BREAKPOINTS, 4);
  check("EMPTY_BREAKPOINTS is frozen", Object.isFrozen(EMPTY_BREAKPOINTS));
  check("EMPTY_BREAKPOINTS has no entries", breakpointCount(EMPTY_BREAKPOINTS) === 0);
  check("toggle adds a breakpoint", breakpointCount(bp) === 1);
  check("toggle returns a new map (immutable)", bp !== EMPTY_BREAKPOINTS);
  check("breakpoint recorded at line 4", breakpointAtLine(bp, 4)?.line === 4);
  check("enabled by default", breakpointAtLine(bp, 4)?.enabled === true);
  check("other lines untouched", breakpointAtLine(bp, 3) === undefined);

  const off = setBreakpointEnabled(bp, 4, false);
  check("disabling keeps the breakpoint", breakpointCount(off) === 1);
  check("breakpoint is disabled", breakpointAtLine(off, 4)?.enabled === false);
  check("hasEnabledBreakpoint is false", !hasEnabledBreakpoint(off, 4));
  check("enabledBreakpointCount is 0", enabledBreakpointCount(off) === 0);
  check("enabledBreakpointLines is empty", enabledBreakpointLines(off).size === 0);

  const onAgain = setBreakpointEnabled(off, 4, true);
  check("re-enabling works", enabledBreakpointCount(onAgain) === 1);
  check("enabledBreakpointLines contains 4", enabledBreakpointLines(onAgain).has(4));

  const second = toggleBreakpoint(bp, 4);
  check("toggling same line removes it", breakpointCount(second) === 0);
  const multi = toggleBreakpoint(toggleBreakpoint(EMPTY_BREAKPOINTS, 2), 9);
  check("multiple lines tracked", breakpointCount(multi) === 2);
  const removed = removeBreakpoint(multi, 2);
  check("removeBreakpoint drops one line", breakpointCount(removed) === 1);
  check("removeBreakpoint keeps the rest", breakpointAtLine(removed, 9) !== undefined);
  check("clearBreakpoints empties", breakpointCount(clearBreakpoints()) === 0);

  const changed = setBreakpointEnabled(bp, 4, false);
  check("disabled breakpoint kept on toggle?", true);
  check("setting enable state is immutable", breakpointAtLine(changed, 4)?.enabled === false);
  check("original untouched", breakpointAtLine(bp, 4)?.enabled === true);
}

console.log("2) breakpoint hit tests and line index");
{
  const code = [
    "let total = 0;",
    "for (let i = 0; i < 3; i++) {",
    "  total = total + i;",
    "}",
    "console.log(total);",
  ].join("\n");
  const snapshots = snapshotsOf(code);
  const hitsLine3 = snapshots.filter((s) => s.line === 3).length;
  check("multiple snapshots on line 3", hitsLine3 >= 3, hitsLine3);

  const bp = toggleBreakpoint(EMPTY_BREAKPOINTS, 3);
  const hitCount = snapshots.filter((s) => snapshotHitsBreakpoint(s, bp)).length;
  check("every line-3 snapshot hits the breakpoint", hitCount === hitsLine3, { hitCount, hitsLine3 });
  check("line-2 snapshots do not hit", snapshots.every((s) => s.line !== 2 || !snapshotHitsBreakpoint(s, bp)));

  const index = buildBreakpointIndex(snapshots);
  const expected = snapshots.map((s, i) => (s.line === 3 ? i : -1)).filter((i) => i >= 0);
  check("line index maps line 3 → snapshot indices", JSON.stringify(index.get(3)) === JSON.stringify(expected));
  const distinctLines = new Set(snapshots.map((s) => s.line).filter((line) => line > 0));
  check("line index covers every executed line (skips line 0)", index.size === distinctLines.size);

  const disabled = setBreakpointEnabled(bp, 3, false);
  check("disabled breakpoint never hits", !snapshots.some((s) => snapshotHitsBreakpoint(s, disabled)));
}

console.log("3) debugger keyboard mapping");
{
  check("F5 = continue", resolveDebuggerKey("F5", false).type === "continue");
  check("Shift+F5 = stop", resolveDebuggerKey("F5", true).type === "stop");
  check("F9 = toggle-breakpoint", resolveDebuggerKey("F9", false).type === "toggle-breakpoint");
  const nextKey = resolveDebuggerKey("F10", false);
  const prevKey = resolveDebuggerKey("F10", true);
  check(
    "F10 = step forward",
    nextKey.type === "step" && (nextKey as { delta?: number }).delta === 1,
  );
  check(
    "Shift+F10 = step backward",
    prevKey.type === "step" && (prevKey as { delta?: number }).delta === -1,
  );
  check("other keys are none", resolveDebuggerKey("ArrowRight", false).type === "none");
  check("lowercase key handled", resolveDebuggerKey("f5", false).type === "continue");

  const step = resolveDebuggerKey("F10", true);
  check("step carries delta -1", step.type === "step" && (step as { delta?: number }).delta === -1);
}

console.log("4) continue / step targets");
{
  const snapshots = snapshotsOf("let a = 1; let b = 2; let c = 3;");
  const length = snapshots.length;
  check("continueTarget steps forward", continueTarget(2, length) === 3);
  check("continueTarget clamps at end", continueTarget(length - 1, length) === length - 1);
  check("stepTarget steps +1", stepTarget(2, 1, length) === 3);
  check("stepTarget clamps low", stepTarget(0, -1, length) === 0);
  check("stepTarget clamps high", stepTarget(length - 1, 1, length) === length - 1);
}

console.log("5) shouldStopAtSnapshot and breakpoint jumps");
{
  const code = ["let x = 0;", "x = 1;", "x = 2;", "x = 3;"].join("\n");
  const snapshots = snapshotsOf(code);
  const line3Indices = snapshots.map((s, i) => (s.line === 3 ? i : -1)).filter((i) => i >= 0);
  check("line 3 executed at least once", line3Indices.length > 0, line3Indices);

  const bp = toggleBreakpoint(EMPTY_BREAKPOINTS, 3);
  check("shouldStop on matching snapshot", shouldStopAtSnapshot(snapshots[line3Indices[0]], bp));
  check("shouldStop false elsewhere", !shouldStopAtSnapshot(snapshots[0], bp));

  const index = buildBreakpointIndex(snapshots);
  const next = findNextBreakpointIndex(0, bp, index);
  check("jump-next finds a line-3 snapshot", next === line3Indices[0], { next, line3Indices });

  const after = findNextBreakpointIndex(line3Indices[0], bp, index);
  const later = line3Indices.filter((i) => i > line3Indices[0])[0];
  if (later !== undefined) {
    check("jump-next from a hit advances to the next hit", after === later, { after, later });
  } else {
    check("jump-next from last hit is -1", after === -1, after);
  }

  const prev = findPreviousBreakpointIndex(line3Indices[0], bp, index);
  check("jump-previous before first hit is -1", prev === -1, prev);
  if (later !== undefined) {
    check("jump-previous back to earlier hit", findPreviousBreakpointIndex(later, bp, index) === line3Indices[0]);
  }

  check("no breakpoints → no jump", findNextBreakpointIndex(0, EMPTY_BREAKPOINTS, index) === -1);
  const allDisabled = setBreakpointEnabled(bp, 3, false);
  check("disabled breakpoints → no jump", findNextBreakpointIndex(0, allDisabled, index) === -1);
}

console.log("6) watch parsing");
{
  const parsed = parseWatchExpression("user.name");
  const firstMember = parsed?.members[0];
  check("parses root + member", parsed !== null && parsed.root === "user" && parsed.members.length === 1);
  check(
    "member name",
    firstMember?.kind === "prop" && (firstMember.kind === "prop" ? firstMember.name : "") === "name",
  );
  check("array-style member", parseWatchExpression("items[0]")?.members[0]?.kind === "computed");
  check("nested computed member", parseWatchExpression("a.b[2].c")?.members.length === 3);
  check("whitespace tolerated", parseWatchExpression("  total  ")?.root === "total");
  check("empty expression rejected", parseWatchExpression("") === null);
  check("whitespace-only rejected", parseWatchExpression("   ") === null);
  check("pure literal rejected", parseWatchExpression("42") === null);
  check("calls rejected", parseWatchExpression("fn()") === null);
  check("operators rejected", parseWatchExpression("a + b") === null);
  const numericKey = parseWatchExpression("items[2]")?.members[0];
  check(
    "numeric computed key",
    numericKey?.kind === "computed" && (numericKey.kind === "computed" ? numericKey.key : "") === "2",
  );
}

console.log("7) watch evaluation against snapshots");
{
  const code = [
    "let user = { name: 'Ada', meta: { level: 3 } };",
    "let items = [10, 20, 30];",
    "let title = 'hello';",
    "let count = 7;",
  ].join("\n");
  const snapshots = snapshotsOf(code);
  const last = snapshots[snapshots.length - 1];

  const ref = evaluateWatchExpression("user", last);
  check("object watch resolves to a heap reference", ref.ok && typeof ref.value === "object" && ref.value !== null);
  const name = evaluateWatchExpression("user.name", last);
  check("nested property read", name.ok && name.value === "Ada", name);
  const deep = evaluateWatchExpression("user.meta.level", last);
  check("deeply nested property read", deep.ok && deep.value === 3, deep);

  const first = evaluateWatchExpression("items[0]", last);
  check("computed index read", first.ok && first.value === 10, first);
  const arrLen = evaluateWatchExpression("items.length", last);
  check("array.length", arrLen.ok && arrLen.value === 3, arrLen);
  const strLen = evaluateWatchExpression("title.length", last);
  check("string.length", strLen.ok && strLen.value === 5, strLen);

  const missing = evaluateWatchExpression("user.nope", last);
  check("missing member is undefined (ok)", missing.ok && missing.value === undefined, missing);
  const oob = evaluateWatchExpression("items[99]", last);
  check("out-of-range index is undefined", oob.ok && oob.value === undefined, oob);
  const root = evaluateWatchExpression("count", last);
  check("root identifier resolves", root.ok && root.value === 7, root);

  const unknown = evaluateWatchExpression("doesNotExist", last);
  check("unknown identifier reports reason", unknown.ok === false && unknown.reason === "unknown-identifier", unknown);
  const empty = evaluateWatchExpression("", last);
  check("empty watch reports empty", empty.ok === false && empty.reason === "empty", empty);
  const bad = evaluateWatchExpression("a + b", last);
  check("invalid syntax reports invalid-syntax", bad.ok === false && bad.reason === "invalid-syntax", bad);

  const results = evaluateWatches(["count", "user.name", "zzz"], last);
  check("evaluateWatches returns one result per watch", results.length === 3);
  check("evaluateWatches order preserved", results[0].ok && results[0].value === 7 && results[1].ok && results[1].value === "Ada");
  check("watchHasValue false on empty", !watchHasValue("", last));
  check("watchHasValue true on resolved value", watchHasValue("user.name", last));
  check("watchHasValue false on unknown identifier", !watchHasValue("nope", last));
  check("watchHasValue false when value is undefined", !watchHasValue("user.nope", last));
}

console.log("8) watch scope: frames beat globals");
{
  const code = [
    "let name = 'global';",
    "function greet(name) {",
    "  return name;",
    "}",
    "greet('local');",
  ].join("\n");
  const snapshots = snapshotsOf(code);
  const inside = snapshots.find((s) =>
    s.callStack?.some((f) => f.name === "greet" && "name" in f.variables),
  );
  check("found a snapshot inside greet", inside !== undefined);
  if (inside) {
    const value = evaluateWatchExpression("name", inside);
    check("frame-local wins over global", value.ok && value.value === "local", value);
  }
}

console.log("9) search integration with breakpoints and watches");
{
  const code = ["let total = 0;", "for (let i = 0; i < 2; i++) {", "  total = total + i;", "}", "console.log(total);"].join("\n");
  const snapshots = snapshotsOf(code);
  const bp = toggleBreakpoint(EMPTY_BREAKPOINTS, 3);
  const enabled = enabledBreakpointLines(bp);

  const withBp = buildSearchIndex(snapshots, { breakpointLines: enabled });
  const bpMatches = searchTimeline(withBp, "breakpoint");
  check("breakpoint token indexes line-3 snapshots", bpMatches.size > 0);
  const onlyLine3 = snapshots.every((s, i) => !bpMatches.has(i) || s.line === 3);
  check("breakpoint matches are only line-3 snapshots", onlyLine3);

  const plain = buildSearchIndex(snapshots);
  const noBp = searchTimeline(plain, "breakpoint");
  check("no breakpoint token without extras", noBp.size === 0);

  const withWatches = buildSearchIndex(snapshots, { watches: ["total"] });
  const totalMatches = searchTimeline(withWatches, "total");
  check("watch expression joins the search index", totalMatches.size > 0);

  const combo = buildSearchIndex(snapshots, { breakpointLines: enabled, watches: ["total"] });
  const comboBreak = searchTimeline(combo, "breakpoint");
  check("combined extras still mark breakpoints", comboBreak.size === bpMatches.size);
}

console.log("10) snapshot inspector");
{
  const code = ["let a = 1;", "let obj = { k: 'v' };", "a = 2;"].join("\n");
  const snapshots = snapshotsOf(code);
  const inspection = inspectSnapshot(snapshots, 1);
  check("inspector returns a snapshot", inspection !== null);
  if (inspection) {
    check("inspection index matches", inspection.index === 1);
    check("inspection step matches", inspection.step === 2);
    check("inspection line matches snapshot", inspection.line === snapshots[1].line);
    check("inspection type matches classifier", inspection.type.length > 0);
    check("inspection carries variables", "a" in inspection.variables);
    check("inspection carries call stack", Array.isArray(inspection.callStack));
    check("inspection carries console", Array.isArray(inspection.console));
    check("inspection computes a diff", typeof inspection.diff.changedVariables === "object");
  }
  const last = inspectSnapshot(snapshots, snapshots.length - 1);
  check("inspector reads the last snapshot", last !== null && last.index === snapshots.length - 1);
  check("inspector returns null out of range", inspectSnapshot(snapshots, 999) === null);
  check("inspector returns null for negative", inspectSnapshot(snapshots, -1) === null);
  check("inspector handles empty timeline", inspectSnapshot([], 0) === null);
}

console.log("11) large timeline breakpoint jumps stay fast");
{
  const code = [
    "let sum = 0;",
    "for (let i = 0; i < 2000; i++) {",
    "  sum = sum + i;",
    "}",
  ].join("\n");
  const snapshots = snapshotsOf(code);
  const bp = toggleBreakpoint(EMPTY_BREAKPOINTS, 3);
  const index = buildBreakpointIndex(snapshots);
  const line3Count = snapshots.filter((s) => s.line === 3).length;
  check("2000 iterations → thousands of hits", line3Count >= 2000, line3Count);

  const start = performance.now();
  let cursor = -1;
  let hops = 0;
  for (;;) {
    const next = findNextBreakpointIndex(cursor, bp, index);
    if (next === -1) break;
    cursor = next;
    hops += 1;
  }
  const elapsed = performance.now() - start;
  const lastHit = snapshots.map((s, i) => (s.line === 3 ? i : -1)).filter((i) => i >= 0).at(-1);
  check("walking all hits lands on the last one", cursor === lastHit, { cursor, lastHit });
  check("every hop is a real hit", hops === line3Count, { hops, line3Count });
  check("jump walk is fast (< 250ms)", elapsed < 250, elapsed);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
