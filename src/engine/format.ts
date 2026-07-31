import type { RuntimeValue } from "./types";

/** Formats a runtime value the way the browser console does (strings raw). */
export function formatValue(value: RuntimeValue): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  return String(value);
}

/** Serializes a value for display in the Variables panel (strings quoted). */
export function formatDisplayValue(value: RuntimeValue): string {
  if (typeof value === "string") return `"${value}"`;
  return formatValue(value);
}
