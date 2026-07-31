/**
 * Smoke tests for the CodeScope execution engine.
 *
 * Run with:  npm run test:engine
 */
import { runCode } from "../src/engine/index";
import type { ExecutionResult, Snapshot } from "../src/engine/index";

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
  const result = runCode("let x = 5;\nif (x > 2) {\n  console.log(x);\n}");
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
