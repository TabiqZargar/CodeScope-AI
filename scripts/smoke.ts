/**
 * Smoke tests for the CodeScope execution engine.
 *
 * Run with:  npm run test:engine
 */
import { isHeapReference, runCode } from "../src/engine/index";
import type {
  ExecutionResult,
  HeapNode,
  HeapObject,
  RuntimeValue,
  Snapshot,
} from "../src/engine/index";

let passed = 0;
let failed = 0;

/** Narrow a heap node to its elements when it is an array. */
function asArray(node: HeapNode | undefined): readonly RuntimeValue[] | null {
  return node && node.type === "array" ? node.elements : null;
}

/** Narrow a heap node to its properties when it is an object. */
function asObject(node: HeapNode | undefined): Readonly<Record<string, RuntimeValue>> | null {
  return node && node.type === "object" ? node.properties : null;
}

/** The heap node snapshot holds the properties that include `key`. */
function objectWith(heap: readonly HeapNode[] | undefined, key: string): HeapObject | undefined {
  return heap?.find(
    (node): node is HeapObject => node.type === "object" && key in node.properties,
  );
}

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

function assertOk(result: ExecutionResult): readonly Snapshot[] {
  check("execution succeeds", result.ok, result);
  return result.snapshots;
}

console.log("1) default program");
{
  const snapshots = assertOk(runCode("let x = 5;\nlet y = x + 2;\nx = y * 3;\nconsole.log(x);"));
  check("5 snapshots (initial + 4 statements)", snapshots.length === 5, snapshots.length);
  const last = snapshots[snapshots.length - 1];
  check("final x === 21", last.variables.x === 21, last.variables);
  check("final y === 7", last.variables.y === 7, last.variables);
  check("console captured 21", last.console.join(" ") === "21", last.console);
  check("immutable console not shared", snapshots[0].console !== snapshots[1].console);
  check("initial snapshot line 0", snapshots[0].line === 0);
  check("line numbers recorded", snapshots[1].line === 1 && snapshots[4].line === 4, snapshots.map((s) => s.line));
}

console.log("2) strings, booleans, comparisons, unary");
{
  const snapshots = assertOk(
    runCode('let a = "Hello" + " " + "world";\nlet b = 10 > 5;\nlet c = !b;\nlet d = -b;\nconsole.log(a, b, c, d);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("string concat", last.variables.a === "Hello world", last.variables.a);
  check("comparison", last.variables.b === true, last.variables.b);
  check("logical not", last.variables.c === false, last.variables.c);
  check("numeric negate", last.variables.d === -1, last.variables.d);
  check("console output", last.console.join(" ") === "Hello world true false -1", last.console);
}

console.log("3) equality operators");
{
  const snapshots = assertOk(
    runCode('let a = 5 == "5";\nlet b = 5 === "5";\nlet c = null == undefined;\nlet d = 1 != 2;\nconsole.log(a, b, c, d);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("loose eq", last.variables.a === true, last.variables.a);
  check("strict eq", last.variables.b === false, last.variables.b);
  check("null == undefined", last.variables.c === true, last.variables.c);
  check("inequality", last.variables.d === true, last.variables.d);
}

console.log("4) let/const/var semantics");
{
  const ok = assertOk(runCode("let x = 1;\nvar y = 2;\nvar y = 3;\nconst z = 4;"));
  check("var redeclare allowed", ok[ok.length - 1].variables.y === 3);
  check("const declared", ok[ok.length - 1].variables.z === 4);

  const re = runCode("let a = 1;\nlet a = 2;");
  check("let redeclare is a SyntaxError", !re.ok && re.error.kind === "parse", re);
  check("redeclare message", re.ok || re.error.message.includes("already been declared"));

  const cst = runCode("const a = 1;\na = 2;");
  check("const assign fails", !cst.ok && cst.error.kind === "runtime", cst);
}

console.log("5) runtime error keeps partial snapshots");
{
  const result = runCode("let x = 5;\nconsole.log(x);\nlet y = z + 1;");
  check("fails", !result.ok);
  check("has partial timeline", result.snapshots.length === 3, result.snapshots.length);
  if (!result.ok) {
    check("error kind runtime", result.error.kind === "runtime");
    check("error line 3", result.error.line === 3, result.error.line);
    check("error message", result.error.message.includes("z is not defined"), result.error.message);
  }
}

console.log("6) unsupported syntax fails cleanly");
{
  const result = runCode("let x = 5;\nswitch (x) {\n  case 1: break;\n}\nconsole.log(x);");
  check("fails", !result.ok);
  if (!result.ok) {
    check("unsupported kind", result.error.kind === "unsupported", result.error);
    check("mentions not supported", result.error.message.includes("This syntax is not supported yet."), result.error.message);
  }
}

console.log("7) parse error fails cleanly");
{
  const result = runCode("let x = ;");
  check("fails", !result.ok);
  if (!result.ok) {
    check("parse kind", result.error.kind === "parse", result.error);
    check("parse line", result.error.line === 1, result.error);
  }
}

console.log("8) no unsafe globals available");
{
  const result = runCode("console.log(window);");
  check("window is not defined", !result.ok, result);
  const ev = runCode("eval('1+1')");
  check("eval unsupported", !ev.ok && !ev.ok && ev.error.kind === "unsupported", ev);
}

console.log("9) simple if");
{
  const snapshots = assertOk(
    runCode('let x = 5;\nlet result = "no";\nif (x > 3) {\n  result = "yes";\n}\nconsole.log(result);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("true branch executed", last.variables.result === "yes", last.variables);
  check("console output", last.console.join(" ") === "yes", last.console);
  const condition = snapshots.find((s) => s.conditionResult !== undefined);
  check("condition snapshot exists", condition !== undefined);
  check("condition result true", condition?.conditionResult === true);
  check("condition source text", condition?.condition === "x > 3", condition?.condition);
  check(
    "condition description",
    condition?.description === "Condition evaluated: x > 3 → true",
    condition?.description,
  );
  check("condition line 3", condition?.line === 3, condition?.line);
  check("timeline length", snapshots.length === 6, snapshots.length);
}

console.log("10) if/else (else branch taken)");
{
  const snapshots = assertOk(
    runCode('let x = 2;\nlet out = "";\nif (x > 3) {\n  out = "big";\n} else {\n  out = "small";\n}\nconsole.log(out);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("else branch executed", last.variables.out === "small", last.variables);
  const condition = snapshots.find((s) => s.conditionResult !== undefined);
  check("condition result false", condition?.conditionResult === false);
  check("skipped branch creates no snapshots", snapshots.length === 6, snapshots.length);
}

console.log("11) else-if chain");
{
  const snapshots = assertOk(
    runCode('let x = 7;\nlet grade = "";\nif (x < 5) {\n  grade = "low";\n} else if (x < 10) {\n  grade = "mid";\n} else {\n  grade = "high";\n}\nconsole.log(grade);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("second branch taken", last.variables.grade === "mid", last.variables);
  const results = snapshots.filter((s) => s.conditionResult !== undefined).map((s) => s.conditionResult);
  check("two conditions evaluated", results.length === 2, results);
  check("results false then true", results[0] === false && results[1] === true, results);
  const texts = snapshots.filter((s) => s.condition !== undefined).map((s) => s.condition);
  check("condition texts", texts.join(",") === "x < 5,x < 10", texts);
  check("timeline length", snapshots.length === 7, snapshots.length);
}

console.log("12) nested if");
{
  const snapshots = assertOk(
    runCode('let x = 5;\nlet out = "";\nif (x > 0) {\n  if (x > 3) {\n    out = "big";\n  } else {\n    out = "small";\n  }\n} else {\n  out = "negative";\n}\nconsole.log(out);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("nested branch executed", last.variables.out === "big", last.variables);
  const results = snapshots.filter((s) => s.conditionResult !== undefined).map((s) => s.conditionResult);
  check("both conditions true", results.length === 2 && results.every(Boolean), results);
}

console.log("13) comparison operators and single-statement branches");
{
  const snapshots = assertOk(
    runCode('let x = 10;\nlet out = "";\nif (x > 5) out = "gt";\nif (x < 5) out = "lt";\nif (x >= 10) out = "ge";\nif (x <= 10) out = "le";\nif (x == 10) out = "eq";\nif (x === 10) out = "seq";\nif (x != 11) out = "ne";\nif (x !== 11) out = "sne";\nconsole.log(out);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("all comparisons evaluated in order", last.variables.out === "sne", last.variables);
  const results = snapshots.filter((s) => s.conditionResult !== undefined).map((s) => s.conditionResult);
  check(
    "comparison results",
    results.join(",") === "true,false,true,true,true,true,true,true",
    results.join(","),
  );
}

console.log("14) logical operators");
{
  const snapshots = assertOk(
    runCode('let a = true;\nlet b = false;\nlet r = "";\nif (a && !b) {\n  r = "and";\n}\nif (b || !a) {\n  r = "or";\n}\nif (!b) {\n  r = "not";\n}\nconsole.log(r);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("logical chain final", last.variables.r === "not", last.variables);
  const results = snapshots.filter((s) => s.conditionResult !== undefined).map((s) => s.conditionResult);
  check("logical results", results.join(",") === "true,false,true", results.join(","));
  const texts = snapshots.filter((s) => s.condition !== undefined).map((s) => s.condition);
  check("logical condition texts", texts.join("|") === "a && !b|b || !a|!b", texts);
}

console.log("15) variable mutations inside branches");
{
  const snapshots = assertOk(
    runCode('let total = 0;\nif (true) {\n  total = total + 5;\n} else {\n  total = total + 100;\n}\nif (false) {\n  total = total + 1000;\n} else {\n  total = total + 1;\n}\nconsole.log(total);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("mutations applied", last.variables.total === 6, last.variables);
  check("console output", last.console.join(" ") === "6", last.console);
  check("timeline length", snapshots.length === 7, snapshots.length);
}

console.log("16) skipped branches create no snapshots");
{
  const snapshots = assertOk(
    runCode('if (false) {\n  let a = 1;\n  let b = 2;\n  console.log("never");\n}\nlet c = 3;'),
  );
  check("only initial + condition + trailing statement", snapshots.length === 3, snapshots.length);
  check("condition snapshot present", snapshots[1].conditionResult === false, snapshots[1]);
  check("skipped vars absent", snapshots[2].variables.a === undefined && snapshots[2].variables.b === undefined);
  check("skipped console absent", snapshots[2].console.length === 0, snapshots[2].console);
}

console.log("17) truthiness of non-boolean values");
{
  const snapshots = assertOk(
    runCode('let s = "hello";\nlet n = 0;\nlet r = "";\nif (s) r = "str";\nif (n) r = "num";\nconsole.log(r);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("truthy string branch taken, falsy zero skipped", last.variables.r === "str", last.variables);
  const results = snapshots.filter((s) => s.conditionResult !== undefined).map((s) => s.conditionResult);
  check("truthiness results", results.join(",") === "true,false", results.join(","));
}

console.log("18) unsupported syntax inside a branch fails cleanly");
{
  const result = runCode('let x = 5;\nif (x > 0) {\n  switch (x) {\n    case 1: break;\n  }\n}\nconsole.log(x);');
  check("fails", !result.ok);
  if (!result.ok) {
    check("unsupported kind", result.error.kind === "unsupported", result.error);
    check("points at switch", result.error.nodeType === "SwitchStatement", result.error);
    check("preflight rejects before execution", result.snapshots.length === 1, result.snapshots.length);
  }
}

console.log("19) simple for");
{
  const snapshots = assertOk(
    runCode('let sum = 0;\nfor (let i = 0; i < 3; i++) {\n  sum = sum + i;\n}\nconsole.log(sum);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("for sum", last.variables.sum === 3, last.variables);
  check("loop variable scoped to loop", last.variables.i === undefined, last.variables);
  check("console output", last.console.join(" ") === "3", last.console);
  const conditions = snapshots.filter((s) => s.loopType === "for" && s.condition !== undefined);
  check("4 condition snapshots (3 true + final false)", conditions.length === 4, conditions.length);
  check("final condition false", conditions[conditions.length - 1]?.conditionResult === false, conditions[conditions.length - 1]);
  check("iteration metadata", conditions.map((s) => s.iteration).join(",") === "1,2,3,4", conditions.map((s) => s.iteration));
  const update = snapshots.find((s) => s.description.startsWith("Incremented"));
  check("update description", update?.description === "Incremented `i` = 1.", update?.description);
  check("timeline length", snapshots.length === 14, snapshots.length);
}

console.log("20) nested for");
{
  const snapshots = assertOk(
    runCode('let sum = 0;\nfor (let i = 0; i < 2; i++) {\n  for (let j = 0; j < 3; j++) {\n    sum = sum + 1;\n  }\n}\nconsole.log(sum);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("nested for sum", last.variables.sum === 6, last.variables);
  check("console output", last.console.join(" ") === "6", last.console);
  const conditions = snapshots.filter((s) => s.condition !== undefined);
  check("condition count (3 outer + 8 inner)", conditions.length === 11, conditions.length);
  check("timeline length", snapshots.length === 31, snapshots.length);
}

console.log("21) while");
{
  const snapshots = assertOk(
    runCode('let i = 0;\nlet s = 0;\nwhile (i < 4) {\n  s = s + 2;\n  i++;\n}\nconsole.log(s);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("while sum", last.variables.s === 8, last.variables);
  check("while counter", last.variables.i === 4, last.variables);
  const conditions = snapshots.filter((s) => s.loopType === "while" && s.condition !== undefined);
  check("while conditions", conditions.length === 5, conditions.length);
  check("while final false", conditions[conditions.length - 1]?.conditionResult === false);
}

console.log("22) do while");
{
  const snapshots = assertOk(
    runCode('let i = 0;\nlet s = 0;\ndo {\n  s = s + 1;\n  i++;\n} while (i < 3);\nconsole.log(s);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("do-while sum", last.variables.s === 3, last.variables);
  const conditions = snapshots.filter((s) => s.loopType === "do-while" && s.condition !== undefined);
  check("do-while conditions", conditions.length === 3, conditions.length);
  check("do-while iterations", conditions.map((s) => s.iteration).join(",") === "1,2,3", conditions.map((s) => s.iteration));
  check("do-while results", conditions.map((s) => s.conditionResult).join(",") === "true,true,false", conditions.map((s) => s.conditionResult));
}

console.log("23) break");
{
  const snapshots = assertOk(
    runCode('let sum = 0;\nfor (let i = 0; i < 10; i++) {\n  if (i === 2) break;\n  sum = sum + i;\n}\nconsole.log(sum);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("break sum", last.variables.sum === 1, last.variables);
  check("console output", last.console.join(" ") === "1", last.console);
  const loopConditions = snapshots.filter((s) => s.loopType === "for" && s.condition !== undefined);
  check("no final failed condition after break", loopConditions.length === 3 && loopConditions.every((c) => c.conditionResult === true), loopConditions.map((c) => c.conditionResult));
}

console.log("24) continue");
{
  const snapshots = assertOk(
    runCode('let sum = 0;\nfor (let i = 0; i < 5; i++) {\n  if (i === 2) continue;\n  sum = sum + i;\n}\nconsole.log(sum);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("continue sum", last.variables.sum === 8, last.variables);
  check("console output", last.console.join(" ") === "8", last.console);
  const loopConditions = snapshots.filter((s) => s.loopType === "for" && s.condition !== undefined);
  check("update still ran after continue", loopConditions.length === 6, loopConditions.length);
  check("final condition false", loopConditions[loopConditions.length - 1]?.conditionResult === false);
}

console.log("25) nested loops");
{
  const snapshots = assertOk(
    runCode('let out = "";\nfor (let i = 0; i < 2; i++) {\n  let row = "";\n  for (let j = 0; j < 2; j++) {\n    row = row + i + j;\n  }\n  out = out + row + ";";\n}\nconsole.log(out);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("nested loops output", last.console.join(" ") === "0001;1011;", last.console);
  check("inner iterations tagged", snapshots.filter((s) => s.loopType === "for" && s.iteration === 2).length >= 3);
}

console.log("26) zero iterations");
{
  const snapshots = assertOk(runCode('let c = 0;\nfor (let i = 0; i < 0; i++) {\n  c++;\n}\nconsole.log(c);'));
  const last = snapshots[snapshots.length - 1];
  check("body never ran", last.variables.c === 0, last.variables);
  const conditions = snapshots.filter((s) => s.loopType === "for" && s.condition !== undefined);
  check("single failed condition", conditions.length === 1 && conditions[0].conditionResult === false, conditions);
}

console.log("27) single iteration");
{
  const snapshots = assertOk(runCode('let i = 0;\nwhile (i < 1) {\n  i++;\n}\nconsole.log(i);'));
  const last = snapshots[snapshots.length - 1];
  check("single iteration", last.variables.i === 1, last.variables);
  const conditions = snapshots.filter((s) => s.loopType === "while" && s.condition !== undefined);
  check("two while conditions", conditions.length === 2, conditions.length);
}

console.log("28) multiple iterations");
{
  const snapshots = assertOk(runCode('let i = 0;\nwhile (i < 100) {\n  i++;\n}\nconsole.log(i);'));
  const last = snapshots[snapshots.length - 1];
  check("hundred iterations", last.variables.i === 100, last.variables);
  const conditions = snapshots.filter((s) => s.loopType === "while" && s.condition !== undefined);
  check("101 while conditions", conditions.length === 101, conditions.length);
}

console.log("29) update expressions");
{
  const snapshots = assertOk(runCode('let n = 5;\nn++;\nn--;\nlet p = ++n;\nlet q = n--;\nconsole.log(n, p, q);'));
  const last = snapshots[snapshots.length - 1];
  check("prefix/postfix semantics", last.variables.n === 5 && last.variables.p === 6 && last.variables.q === 6, last.variables);
  check("console output", last.console.join(" ") === "5 6 6", last.console);
  check("increment description", snapshots[2].description === "Incremented `n` = 6.", snapshots[2].description);
}

console.log("30) infinite loop protection");
{
  const result = runCode("let x = 0;\nwhile (true) {\n  x = x + 1;\n}");
  check("fails", !result.ok);
  if (!result.ok) {
    check("runtime kind", result.error.kind === "runtime", result.error);
    check("mentions step limit", result.error.message.includes("step limit"), result.error.message);
    check("partial timeline bounded", result.snapshots.length <= 10000, result.snapshots.length);
  }

  const limited = runCode("let x = 0;\nwhile (x < 100000) {\n  x = x + 1;\n}", { maxSteps: 50 });
  check("custom limit fails", !limited.ok);
  check("custom limit bounded", limited.snapshots.length <= 50, limited.snapshots.length);
}

console.log("31) continue in do while");
{
  const snapshots = assertOk(
    runCode('let i = 0;\nlet s = 0;\ndo {\n  i++;\n  if (i === 2) continue;\n  s = s + i;\n} while (i < 4);\nconsole.log(s);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("do-while continue sum", last.variables.s === 8, last.variables);
  check("console output", last.console.join(" ") === "8", last.console);
  const conditions = snapshots.filter((s) => s.loopType === "do-while" && s.condition !== undefined);
  check("do-while conditions after continue", conditions.length === 4 && conditions.map((c) => c.conditionResult).join(",") === "true,true,true,false", conditions.map((c) => c.conditionResult));
}

console.log("32) break in while");
{
  const snapshots = assertOk(
    runCode('let i = 0;\nlet s = 0;\nwhile (true) {\n  i++;\n  if (i > 3) break;\n  s = s + i;\n}\nconsole.log(s);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("while break sum", last.variables.s === 6, last.variables);
  check("console output", last.console.join(" ") === "6", last.console);
  const conditions = snapshots.filter((s) => s.loopType === "while" && s.condition !== undefined);
  check("while conditions all true", conditions.length === 4 && conditions.every((c) => c.conditionResult === true), conditions.map((c) => c.conditionResult));
}

console.log("33) single function call and required descriptions");
{
  const snapshots = assertOk(
    runCode("function add(a, b) {\n  return a + b;\n}\nlet total = add(2, 3);\nconsole.log(total);"),
  );
  const last = snapshots[snapshots.length - 1];
  check("function result", last.variables.total === 5, last.variables);
  check("console output", last.console.join(" ") === "5", last.console);
  const descriptions = snapshots.map((s) => s.description);
  const entering = snapshots.findIndex((s) => s.description === "Entering function add");
  check("entering description", entering !== -1, descriptions);
  check("parameter descriptions", snapshots.find((s) => s.description === "Parameter a = 2") !== undefined && snapshots.find((s) => s.description === "Parameter b = 3") !== undefined, descriptions);
  check("returning description", snapshots.find((s) => s.description === "Returning value 5") !== undefined, descriptions);
  check("leaving description", snapshots.find((s) => s.description === "Leaving function add") !== undefined, descriptions);
  const entered = snapshots[entering];
  check("frame pushed on entering", entered.callStack?.length === 1 && entered.callStack[0].name === "add", entered.callStack);
  check("current frame marked", entered.CurrentFrame === entered.callStack?.[0].id, entered.CurrentFrame);
  check("frame starts empty", Object.keys(entered.callStack?.[0].variables ?? {}).length === 0, entered.callStack?.[0].variables);
  const leaving = snapshots[snapshots.findIndex((s) => s.description === "Leaving function add")];
  check("frame popped on leaving", leaving.callStack?.length === 0, leaving.callStack);
  check("call stack deep-frozen", Object.isFrozen(entered.callStack!) && Object.isFrozen(entered.callStack![0].variables), entered.callStack);
  const paramSnapshot = snapshots.find((s) => s.description === "Parameter b = 3");
  check("frame locals only params", JSON.stringify(paramSnapshot?.callStack?.[0].variables) === JSON.stringify({ a: 2, b: 3 }), paramSnapshot?.callStack?.[0].variables);
  check("top-level snapshots have empty stack", snapshots[snapshots.length - 1].callStack?.length === 0);
}

console.log("34) parameters: missing and extra arguments");
{
  const snapshots = assertOk(
    runCode('function show(a, b) {\n  console.log(a, b);\n}\nshow(1);\nshow(1, 2, 3);'),
  );
  const last = snapshots[snapshots.length - 1];
  check("missing arg undefined, extra ignored", last.console.join(" ") === "1 undefined 1 2", last.console);
}

console.log("35) implicit return is undefined");
{
  const snapshots = assertOk(
    runCode("function f() {\n  let x = 5;\n}\nlet r = f();\nconsole.log(r);"),
  );
  const last = snapshots[snapshots.length - 1];
  check("implicit return value", last.variables.r === undefined, last.variables.r);
  check("console output", last.console.join(" ") === "undefined", last.console);
  check("leaving snapshot exists", snapshots.some((s) => s.description === "Leaving function f"));
  check("no returning snapshot for implicit return", !snapshots.some((s) => s.description.startsWith("Returning value")), snapshots.map((s) => s.description));
}

console.log("36) multiple return statements");
{
  const snapshots = assertOk(
    runCode('function classify(n) {\n  if (n > 0) return "pos";\n  if (n < 0) return "neg";\n  return "zero";\n}\nconsole.log(classify(5), classify(-1), classify(0));'),
  );
  const last = snapshots[snapshots.length - 1];
  check("all returns honored", last.console.join(" ") === "pos neg zero", last.console);
  const returns = snapshots.filter((s) => s.description.startsWith("Returning value"));
  check("three returning snapshots", returns.length === 3, returns.map((s) => s.description));
  check("returning descriptions", returns.map((s) => s.description).join("|") === "Returning value pos|Returning value neg|Returning value zero", returns.map((s) => s.description));
}

console.log("37) empty return");
{
  const snapshots = assertOk(
    runCode("function stop() {\n  if (true) return;\n  return 1;\n}\nconsole.log(stop());"),
  );
  const last = snapshots[snapshots.length - 1];
  check("empty return yields undefined", last.console.join(" ") === "undefined", last.console);
  check("empty return description", snapshots.some((s) => s.description === "Returning value undefined"), snapshots.map((s) => s.description));
}

console.log("38) nested calls");
{
  // A call inside a body: both frames are alive at once.
  const snapshots = assertOk(
    runCode("function add(a, b) {\n  return a + b;\n}\nfunction compute() {\n  return add(2, 3);\n}\nconsole.log(compute());"),
  );
  const last = snapshots[snapshots.length - 1];
  check("nested call result", last.console.join(" ") === "5", last.console);
  const maxDepth = Math.max(...snapshots.map((s) => s.callStack?.length ?? 0));
  check("max depth 2", maxDepth === 2, maxDepth);
  const addEnter = snapshots.find((s) => s.description === "Entering function add");
  check("nested frames", addEnter?.callStack?.map((f) => f.name).join(">") === "compute>add", addEnter?.callStack?.map((f) => f.name));
  check("outer frame stopped at call site", addEnter?.callStack?.[0].line === 5, addEnter?.callStack?.[0].line);
}
{
  // Arguments are evaluated before the callee enters (JS order).
  const snapshots = assertOk(
    runCode("function double(x) {\n  return x * 2;\n}\nfunction add(a, b) {\n  return a + b;\n}\nconsole.log(add(double(3), 4));"),
  );
  const last = snapshots[snapshots.length - 1];
  check("arg eval order result", last.console.join(" ") === "10", last.console);
  const doubleEnter = snapshots.find((s) => s.description === "Entering function double");
  check("arg runs before callee frame", doubleEnter?.callStack?.length === 1, doubleEnter?.callStack?.map((f) => f.name));
}
{
  // A bare call emits its own frames but no trailing statement snapshot.
  const snapshots = assertOk(runCode("function noop() {\n  return 1;\n}\nnoop();"));
  check(
    "bare call no trailing snapshot",
    snapshots.slice(1).map((s) => s.description).join("|") === "Entering function noop|Returning value 1|Leaving function noop",
    snapshots.map((s) => s.description),
  );
}

console.log("39) recursive factorial");
{
  const snapshots = assertOk(
    runCode("function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nconsole.log(fact(4));"),
  );
  const last = snapshots[snapshots.length - 1];
  check("factorial result", last.console.join(" ") === "24", last.console);
  const maxDepth = Math.max(...snapshots.map((s) => s.callStack?.length ?? 0));
  check("recursion depth 4", maxDepth === 4, maxDepth);
  check("every frame named fact", snapshots.every((s) => (s.callStack ?? []).every((f) => f.name === "fact")));
  check("nested frame params", snapshots.some((s) => (s.callStack ?? []).length === 4 && (s.callStack?.[3].variables.n ?? -1) === 1), snapshots.map((s) => s.callStack?.map((f) => f.variables.n)));
}

console.log("40) recursive fibonacci");
{
  const snapshots = assertOk(
    runCode("function fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\nconsole.log(fib(7));"),
  );
  const last = snapshots[snapshots.length - 1];
  check("fibonacci result", last.console.join(" ") === "13", last.console);
  check("timeline has entering snapshots", snapshots.filter((s) => s.description.startsWith("Entering")).length > 10, snapshots.filter((s) => s.description.startsWith("Entering")).length);
}

console.log("41) local scope stays isolated");
{
  const snapshots = assertOk(
    runCode("let g = 10;\nfunction f() {\n  let local = g + 1;\n  return local;\n}\nlet result = f();\nconsole.log(result);"),
  );
  const last = snapshots[snapshots.length - 1];
  check("function read global", last.variables.result === 11, last.variables);
  check("local not leaked to global", last.variables.local === undefined, last.variables);
  const leaked = runCode("function f() {\n  let local = 1;\n  return local;\n}\nf();\nconsole.log(local);");
  check("local inaccessible after return", !leaked.ok && leaked.error.kind === "runtime" && leaked.error.message.includes("local is not defined"), leaked);
  check("local error line 6", leaked.ok || leaked.error.line === 6, leaked.ok || leaked.error.line);
}

console.log("42) parameter shadows global");
{
  const snapshots = assertOk(
    runCode("let a = 1;\nfunction f(a) {\n  return a + 1;\n}\nconsole.log(f(10), a);"),
  );
  const last = snapshots[snapshots.length - 1];
  check("shadowed param wins in body", last.console.join(" ") === "11 1", last.console);
  const entering = snapshots.find((s) => s.description === "Entering function f");
  check("frame variables are isolated", JSON.stringify(entering?.callStack?.[0].variables) === JSON.stringify({ a: 1 }) || JSON.stringify(entering?.callStack?.[0].variables) === "{}", entering?.callStack?.[0].variables);
}

console.log("43) var is function scoped");
{
  const snapshots = assertOk(
    runCode("function f() {\n  var x = 5;\n  return x;\n}\nconsole.log(f());"),
  );
  const last = snapshots[snapshots.length - 1];
  check("var body value", last.console.join(" ") === "5", last.console);
  check("var not leaked to global", last.variables.x === undefined, last.variables);
}

console.log("44) call before declaration (hoisting)");
{
  const snapshots = assertOk(
    runCode('console.log(greet("Ada"));\nfunction greet(name) {\n  return "Hi " + name;\n}'),
  );
  const last = snapshots[snapshots.length - 1];
  check("hoisted call works", last.console.join(" ") === "Hi Ada", last.console);
  check("hoisting emits no declaration snapshot", !snapshots.some((s) => s.description.startsWith("Declared")), snapshots.map((s) => s.description));
}

console.log("45) unknown function error");
{
  const result = runCode("hello();");
  check("fails", !result.ok);
  if (!result.ok) {
    check("runtime kind", result.error.kind === "runtime", result.error);
    check("message names function", result.error.message.includes("hello is not defined"), result.error.message);
    check("error line 1", result.error.line === 1, result.error.line);
  }
  const nested = runCode("function f() {\n  return g();\n}\nconsole.log(f());");
  check("nested unknown fails", !nested.ok);
  check("nested unknown points at inner call", nested.ok || (nested.error.kind === "runtime" && nested.error.line === 2), nested.ok || nested.error);
}

console.log("46) deep recursion protection");
{
  const source = "function f(n) {\n  if (n <= 0) return 0;\n  return f(n - 1);\n}\nf(100000);";
  const limited = runCode(source, { maxSteps: 200 });
  check("custom limit stops recursion", !limited.ok);
  if (!limited.ok) {
    check("runtime kind", limited.error.kind === "runtime", limited.error);
    check("mentions step limit", limited.error.message.includes("step limit"), limited.error.message);
    check("partial timeline bounded", limited.snapshots.length <= 200, limited.snapshots.length);
  }
  const defaultRun = runCode(source);
  check("default limit stops recursion gracefully", !defaultRun.ok);
  if (!defaultRun.ok) {
    check("runtime kind", defaultRun.error.kind === "runtime", defaultRun.error);
    check("graceful message", defaultRun.error.message.includes("step limit") || defaultRun.error.message.includes("stack"), defaultRun.error.message);
  }
}

console.log("47) nested declaration captures outer scope");
{
  const snapshots = assertOk(
    runCode("function outer() {\n  let secret = 42;\n  function inner() {\n    return secret;\n  }\n  return inner();\n}\nconsole.log(outer());"),
  );
  const last = snapshots[snapshots.length - 1];
  check("nested function sees outer locals", last.console.join(" ") === "42", last.console);
  const innerEnter = snapshots.find((s) => s.description === "Entering function inner");
  check("inner frame nested under outer", innerEnter?.callStack?.map((f) => f.name).join(">") === "outer>inner", innerEnter?.callStack?.map((f) => f.name));
  const afterLeave = snapshots.findIndex((s) => s.description === "Leaving function inner");
  check("inner stack cleared after leaving", snapshots[afterLeave + 1]?.callStack?.map((f) => f.name).join(">") === "outer", snapshots[afterLeave + 1]?.callStack);
}

console.log("48) nested shadowing restores outer binding");
{
  const snapshots = assertOk(
    runCode("function helper() {\n  return 1;\n}\nfunction outer() {\n  function helper() {\n    return 2;\n  }\n  return helper();\n}\nconsole.log(outer(), helper());"),
  );
  const last = snapshots[snapshots.length - 1];
  check("local helper wins inside, global after", last.console.join(" ") === "2 1", last.console);
}

console.log("49) frame ids unique across timeline");
{
  const snapshots = assertOk(
    runCode("function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nconsole.log(fact(5));"),
  );
  const ids = snapshots.flatMap((s) => (s.callStack ?? []).map((f) => f.id));
  const enteringCount = snapshots.filter((s) => s.description.startsWith("Entering function fact")).length;
  check("each entry gets a fresh, never-reused id", new Set(ids).size === enteringCount && enteringCount === 5, { instances: ids.length, unique: new Set(ids).size, entering: enteringCount });
  check("current frame always present in stack", snapshots.every((s) => s.CurrentFrame === undefined || (s.callStack ?? []).some((f) => f.id === s.CurrentFrame)));
}

console.log("50) object and array creation");
{
  const snapshots = assertOk(
    runCode('let user = { name: "Alice", age: 30 };\nconsole.log(user);'),
  );
  const last = snapshots[snapshots.length - 1];
  const ref = last.variables.user;
  check("user holds a heap reference", isHeapReference(ref), ref);
  check("heap attached once objects exist", last.heap !== undefined, last.heap);
  check("one heap node", last.heap?.length === 1, last.heap);
  const props = asObject(last.heap?.[0]);
  check("node is an object with properties", props !== null && props.name === "Alice" && props.age === 30, last.heap?.[0]);
  check("console prints ref id", last.console.join(" ") === "ref_1", last.console);
  check("declared description shows arrow", snapshots[1].description === "Declared `user` = → ref_1.", snapshots[1].description);

  const arrSnapshots = assertOk(runCode("let nums = [1, 2, 3];"));
  const arrLast = arrSnapshots[arrSnapshots.length - 1];
  check("nums holds a heap reference", isHeapReference(arrLast.variables.nums), arrLast.variables.nums);
  check("node is an array", asArray(arrLast.heap?.[0]) !== null, arrLast.heap?.[0]);
  check("elements stored", JSON.stringify(asArray(arrLast.heap?.[0])) === "[1,2,3]", asArray(arrLast.heap?.[0]));
}

console.log("51) nested objects and arrays");
{
  const snapshots = assertOk(runCode("let a = { b: { c: 1 } };\nlet v = a.b.c;"));
  const last = snapshots[snapshots.length - 1];
  check("two heap nodes", last.heap?.length === 2, last.heap);
  const outer = objectWith(last.heap, "b");
  const inner = objectWith(last.heap, "c");
  check("outer.b points at inner ref", outer !== undefined && inner !== undefined && isHeapReference(outer.properties.b) && inner.id === outer.properties.b.id, { outer, inner });
  check("inner.c readable", last.variables.v === 1, last.variables.v);

  const arrSnapshots = assertOk(runCode("let m = [[1, 2], [3]];\nlet first = m[0][1];"));
  const arrLast = arrSnapshots[arrSnapshots.length - 1];
  check("three array nodes", arrLast.heap?.length === 3, arrLast.heap);
  check("nested index read", arrLast.variables.first === 2, arrLast.variables.first);
}

console.log("52) reference semantics: aliasing, mutation, functions");
{
  const snapshots = assertOk(runCode("let a = { x: 1 };\nlet b = a;\nlet same = b === a;"));
  const last = snapshots[snapshots.length - 1];
  check("alias shares the same reference", last.variables.b === last.variables.a, { a: last.variables.a, b: last.variables.b });
  check("identity comparison true", last.variables.same === true, last.variables.same);

  const mutSnapshots = assertOk(runCode("let a = { x: 1 };\nlet b = a;\nb.x = 2;"));
  const mutLast = mutSnapshots[mutSnapshots.length - 1];
  check("mutation through alias visible on shared node", asObject(mutLast.heap?.[0])?.x === 2, asObject(mutLast.heap?.[0]));
  const priorProps = asObject(mutSnapshots[1].heap?.[0]);
  check("prior snapshot still holds old value", priorProps?.x === 1, priorProps);
  check("prior heap node deeply frozen", priorProps !== null && Object.isFrozen(priorProps), mutSnapshots[1].heap?.[0]);

  const fnSnapshots = assertOk(
    runCode("function setAge(user, age) {\n  user.age = age;\n}\nlet u = { name: \"A\" };\nsetAge(u, 30);\nconsole.log(u.age);"),
  );
  const fnLast = fnSnapshots[fnSnapshots.length - 1];
  const uRef = fnLast.variables.u;
  check("object mutated inside function", fnLast.console.join(" ") === "30", fnLast.console);
  check("function param holds same ref", isHeapReference(uRef) && fnSnapshots.some((s) => (s.callStack ?? []).some((f) => f.name === "setAge" && isHeapReference(f.variables.user) && f.variables.user.id === uRef.id)), fnSnapshots.map((s) => s.callStack));

  const retSnapshots = assertOk(runCode("function make() {\n  return { n: 1 };\n}\nlet o = make();\nlet again = make();"));
  const retLast = retSnapshots[retSnapshots.length - 1];
  check("returned object is a fresh heap node", retLast.heap?.length === 2, retLast.heap);
  check("two calls give distinct refs", retLast.variables.o !== retLast.variables.again, { o: retLast.variables.o, again: retLast.variables.again });
}

console.log("53) array methods");
{
  const pushSnapshots = assertOk(runCode("let arr = [1, 2];\nlet n = arr.push(3, 4);\nconsole.log(arr.length);"));
  const pushLast = pushSnapshots[pushSnapshots.length - 1];
  check("push returns new length", pushLast.variables.n === 4, pushLast.variables.n);
  check("push appended elements", JSON.stringify(asArray(pushLast.heap?.[0])) === "[1,2,3,4]", asArray(pushLast.heap?.[0]));

  const popSnapshots = assertOk(runCode("let arr = [1, 2, 3];\nlet last = arr.pop();"));
  const popLast = popSnapshots[popSnapshots.length - 1];
  check("pop returns removed element", popLast.variables.last === 3, popLast.variables.last);
  check("pop shrank array", JSON.stringify(asArray(popLast.heap?.[0])) === "[1,2]", asArray(popLast.heap?.[0]));

  const shiftSnapshots = assertOk(runCode("let arr = [2, 3];\nlet first = arr.shift();\narr.unshift(1);"));
  const shiftLast = shiftSnapshots[shiftSnapshots.length - 1];
  check("shift returns removed element", shiftLast.variables.first === 2, shiftLast.variables.first);
  check("shift then unshift", JSON.stringify(asArray(shiftLast.heap?.[0])) === "[1,3]", asArray(shiftLast.heap?.[0]));

  const idxSnapshots = assertOk(runCode("let arr = [1];\narr[3] = 4;\nlet len = arr.length;"));
  const idxLast = idxSnapshots[idxSnapshots.length - 1];
  check("index assignment grows array with holes", idxLast.variables.len === 4, idxLast.variables.len);
  check("assigned index present", asArray(idxLast.heap?.[0])?.[3] === 4, asArray(idxLast.heap?.[0]));

  const holeSnapshots = assertOk(runCode("let arr = [1, , 3];\nlet mid = arr[1];"));
  const holeLast = holeSnapshots[holeSnapshots.length - 1];
  check("array holes read as undefined", holeLast.variables.mid === undefined, holeLast.variables.mid);
  check("hole length preserved", asArray(holeLast.heap?.[0])?.length === 3, asArray(holeLast.heap?.[0]));

  const truncateSnapshots = assertOk(runCode("let arr = [1, 2, 3];\narr.length = 1;"));
  const truncateLast = truncateSnapshots[truncateSnapshots.length - 1];
  check("length assignment truncates", JSON.stringify(asArray(truncateLast.heap?.[0])) === "[1]", asArray(truncateLast.heap?.[0]));

  const computedSnapshots = assertOk(runCode("let i = 0;\nlet arr = [10, 20];\nlet v = arr[i];"));
  const computedLast = computedSnapshots[computedSnapshots.length - 1];
  check("computed member read", computedLast.variables.v === 10, computedLast.variables.v);
}

console.log("54) heap snapshots and immutability");
{
  const snapshots = assertOk(runCode("let x = 1;\nlet o = { a: 1 };\nlet y = 2;"));
  check("heap absent before first object", snapshots[1].heap === undefined, snapshots[1]);
  check("heap present once object created", snapshots[2].heap?.length === 1, snapshots[2].heap);
  check("heap present on later steps", snapshots[3].heap?.length === 1, snapshots[3].heap);

  const mutSnapshots = assertOk(runCode("let o = { x: 1 };\no.x = 2;"));
  check("snapshots do not share heap arrays", mutSnapshots[1].heap !== mutSnapshots[2].heap, mutSnapshots.map((s) => s.heap));
  check("heap array frozen", mutSnapshots[2].heap !== undefined && Object.isFrozen(mutSnapshots[2].heap), mutSnapshots[2].heap);
  const mutNode = mutSnapshots[2].heap?.[0];
  check("heap node frozen", mutNode !== undefined && Object.isFrozen(mutNode), mutNode);

  const keySnapshots = assertOk(runCode('let k = "name";\nlet o = { [k]: "Bob" };\nconsole.log(o.name);'));
  const keyLast = keySnapshots[keySnapshots.length - 1];
  check("computed object key", keyLast.console.join(" ") === "Bob", keyLast.console);
}

console.log("55) heap error handling");
{
  const read = runCode("let o = 5;\nconsole.log(o.x);");
  check("read on non-object fails", !read.ok);
  if (!read.ok) check("read error message", read.error.message.includes("Cannot read properties of a non-object value."), read.error);

  const write = runCode("let o = 5;\no.x = 1;");
  check("write on non-object fails", !write.ok);
  if (!write.ok) check("write error message", write.error.message.includes("Cannot set properties of a non-object value."), write.error);

  const call = runCode("let o = { a: 1 };\no.push(1);");
  check("method on object fails", !call.ok);
  if (!call.ok) check("method error message", call.error.message.includes("push is not a function."), call.error);

  const map = runCode("let arr = [1, 2];\narr.map((x) => x);");
  check("unsupported method call fails", !map.ok && map.error.kind === "unsupported", map);

  const spread = runCode("let rest = { a: 1 };\nlet o = { ...rest };");
  check("object spread unsupported", !spread.ok && spread.error.kind === "unsupported", spread);

  const oob = assertOk(runCode("let arr = [1];\nlet v = arr[10];"));
  check("out-of-bounds read yields undefined", oob[oob.length - 1].variables.v === undefined, oob[oob.length - 1].variables);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
