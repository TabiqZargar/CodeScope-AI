import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with precedence (used across all UI components). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
