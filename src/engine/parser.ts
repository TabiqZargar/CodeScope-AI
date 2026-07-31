import { parse } from "@babel/parser";
import type { Program } from "@babel/types";
import { CodeScopeError } from "./types";

/** Shape of the error Babel throws for invalid syntax. */
interface BabelSyntaxError extends Error {
  loc?: { line: number; column: number };
  reasonCode?: string;
}

function humanizeReason(reason: string): string {
  return reason
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Extract a clean, single-line message from Babel's error.
 * Babel appends a `(line:column)` position suffix we don't need, since the
 * error is displayed in a dedicated panel with its own line reference.
 */
function cleanMessage(error: BabelSyntaxError): string {
  if (!error.message) return "";
  return error.message.replace(/\s*\(\d+:\d+\)\s*$/, "").trim();
}

/**
 * Parse a source string into a Babel AST.
 *
 * Throws a `CodeScopeError` with a friendly, user-facing message when the
 * source does not parse. Comments are not attached to the AST so our
 * self-walker only ever sees syntax nodes.
 */
export function parseSource(source: string): Program {
  try {
    const file = parse(source, {
      // "script" mode keeps the playground close to a browser scratchpad:
      // `var` redeclaration works, and module-only syntax is not expected.
      sourceType: "script",
      errorRecovery: false,
      attachComment: false,
    });
    return file.program;
  } catch (err) {
    const error = err as BabelSyntaxError;
    const cleaned = cleanMessage(error);
    const reason =
      (cleaned || humanizeReason(error.reasonCode ?? "UnexpectedToken")).replace(/\.$/, "");
    const location = error.loc
      ? ` on line ${error.loc.line}, column ${error.loc.column + 1}`
      : "";

    throw new CodeScopeError({
      kind: "parse",
      message: `Syntax error${location}: ${reason}.`,
      line: error.loc?.line,
      column: error.loc?.column,
    });
  }
}
