import { classifySnapshot } from "../debugger/snapshot-type";
import { computeDiff } from "../debugger/diff";
import type { Snapshot } from "../engine/types";
import type { DiffFact, ExplainPayload, Explanation } from "./types";

/**
 * Prompt construction for the AI explanation system.
 *
 * Everything sent to a model is built here from immutable snapshots. The
 * payload is a minimal, deterministic projection: the interpreter's own
 * description, the debugger's classification, and the facts it already knows
 * (variables, call stack, heap, console, condition, loop, diff). Source code,
 * breakpoints, bookmarks and local settings are never included.
 */

/**
 * Build the structured payload for one snapshot. Pure and deterministic:
 * the same snapshot + predecessor always produce the same payload, which is
 * what makes the explanation cache safe to key on.
 */
export function buildExplainPayload(
  snapshot: Snapshot,
  previous?: Snapshot,
): ExplainPayload {
  const diff = computeDiff(previous, snapshot);
  const diffFact: DiffFact = {
    addedVariables: diff.addedVariables,
    changedVariables: diff.changedVariables.map((change) => ({
      name: change.name,
      before: change.before,
      after: change.after,
    })),
    removedVariables: diff.removedVariables,
    consoleAdded: diff.consoleAdded,
    framesAdded: diff.framesAdded,
    framesRemoved: diff.framesRemoved,
    heapAdded: diff.heapAdded,
    heapChanged: diff.heapChanged,
  };

  return {
    currentLine: snapshot.line,
    description: snapshot.description,
    snapshotType: classifySnapshot(snapshot, previous),
    variables: snapshot.variables,
    callStack: (snapshot.callStack ?? []).map((frame) => ({
      name: frame.name,
      variables: frame.variables,
    })),
    heap: (snapshot.heap ?? []).map((node) =>
      node.type === "object"
        ? { id: node.id, type: "object" as const, properties: node.properties }
        : { id: node.id, type: "array" as const, elements: node.elements },
    ),
    console: [...snapshot.console],
    condition: snapshot.condition,
    conditionResult: snapshot.conditionResult,
    loop: snapshot.loopType,
    iteration: snapshot.iteration,
    diff: diffFact,
    previousSnapshotDescription: previous?.description,
  };
}

/** System prompt: role, rules, and the required JSON contract. */
export const EXPLAIN_SYSTEM_PROMPT = `You are an expert JavaScript educator inside a step-by-step code visualizer. You explain one execution step to a student. You are given structured facts about the step: the line, the interpreter's own description, the step type, variables in scope, the call stack, the heap, console output, the condition and its result, the loop and iteration, and what changed since the previous step.

Rules:
- Only explain facts that are present in the input. Never invent runtime state, variables, values, or behavior.
- If something would help but is unknown, say so explicitly ("unknown").
- Be technically correct, concise, and educational. Target a beginner-to-intermediate JavaScript learner.
- Always respond with valid JSON only, no markdown fences, no commentary, matching exactly this shape:
{
  "summary": "One short paragraph: what happened at this step.",
  "reason": "One short paragraph: why it happened (semantics of the statement).",
  "changes": ["list", "of", "user-visible", "state", "changes"],
  "concept": "The relevant JavaScript concept this step teaches, in one short paragraph.",
  "commonMistake": "One common beginner mistake related to this step, with a one-line fix.",
  "nextStep": "What most likely happens next, based only on the facts given.",
  "confidence": "high|medium|low"
}`;

/** Build the user prompt for a given payload. */
export function buildExplainPrompt(payload: ExplainPayload): { system: string; user: string } {
  return {
    system: EXPLAIN_SYSTEM_PROMPT,
    user: `Explain this execution step. Facts (never assume more than this):\n${JSON.stringify(
      payload,
      null,
      2,
    )}`,
  };
}

/** Pull a JSON object out of text that may contain prose or code fences. */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Plain JSON object.
  if (trimmed.startsWith("{")) {
    const end = findBalancedEnd(trimmed);
    if (end > 0) return trimmed.slice(0, end);
  }

  // Fenced JSON: ```json ... ``` or ``` ... ```.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{")) return inner;
  }

  // First `{ ... }` block anywhere in the response.
  const start = trimmed.indexOf("{");
  if (start >= 0) {
    const end = findBalancedEnd(trimmed.slice(start));
    if (end > 0) return trimmed.slice(start, start + end);
  }
  return null;
}

/** Index just past the closing brace of the object starting at index 0. */
function findBalancedEnd(text: string): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

const isConfidence = (value: unknown): value is Explanation["confidence"] =>
  value === "high" || value === "medium" || value === "low";

/**
 * Parse a model response into a structured Explanation. Lenient by design:
 * accepts plain JSON, fenced JSON, or prose sections, and never throws — a
 * malformed response degrades to partial fields with low confidence rather
 * than crashing the panel.
 */
export function parseExplanation(raw: string): Explanation {
  const object = extractJsonObject(raw);
  let json: Record<string, unknown> = {};
  if (object) {
    try {
      const parsed: unknown = JSON.parse(object);
      if (parsed !== null && typeof parsed === "object") json = parsed as Record<string, unknown>;
    } catch {
      json = {};
    }
  }

  const stringField = (key: string): string => {
    const value = json[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const changes = Array.isArray(json.changes)
    ? json.changes.filter((item): item is string => typeof item === "string")
    : [];

  return {
    summary: stringField("summary"),
    reason: stringField("reason"),
    changes,
    concept: stringField("concept"),
    commonMistake: stringField("commonMistake"),
    nextStep: stringField("nextStep"),
    confidence: isConfidence(json.confidence) ? json.confidence : "low",
  };
}

/** True when a parsed explanation carries any usable content. */
export function isUsableExplanation(explanation: Explanation): boolean {
  return (
    explanation.summary.length > 0 ||
    explanation.reason.length > 0 ||
    explanation.concept.length > 0
  );
}
