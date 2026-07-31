import { isHeapReference, type RuntimeValue } from "./types";

/** Formats a runtime value the way the browser console does (strings raw). */
export function formatValue(value: RuntimeValue): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (isHeapReference(value)) return value.id;
  return String(value);
}

/**
 * Serializes a value for display in the Variables panel (strings quoted,
 * heap references shown with an arrow, e.g. `→ ref_1`).
 */
export function formatDisplayValue(value: RuntimeValue): string {
  if (typeof value === "string") return `"${value}"`;
  if (isHeapReference(value)) return `→ ${value.id}`;
  return formatValue(value);
}
