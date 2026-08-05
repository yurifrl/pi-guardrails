/**
 * Self-contained matching + escalation parsing for the guidance extension.
 *
 * No imports from upstream `src/` so this feature stays rebase-safe.
 */
import type { GuidancePattern } from "./config";

/**
 * Marker the model appends to acknowledge the guidance and proceed. Its
 * presence makes guidance step aside so the command reaches the real gate
 * (permission-gate), which then blocks or asks as configured.
 */
const PROCEED_MARKER = /#\s*guardrails:approve\b/i;

/** True when the command carries the proceed marker. */
export function wantsToProceed(command: string): boolean {
  return PROCEED_MARKER.test(command);
}

function testPattern(command: string, entry: GuidancePattern): boolean {
  if (entry.regex) {
    try {
      return new RegExp(entry.pattern).test(command);
    } catch {
      return false;
    }
  }
  return command.includes(entry.pattern);
}

/** First guidance pattern that matches the command, or null. */
export function matchGuidance(
  command: string,
  patterns: GuidancePattern[],
): GuidancePattern | null {
  for (const entry of patterns) {
    if (testPattern(command, entry)) return entry;
  }
  return null;
}
