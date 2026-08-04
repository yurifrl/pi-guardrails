/**
 * Self-contained matching + escalation parsing for the guidance extension.
 *
 * No imports from upstream `src/` so this feature stays rebase-safe.
 */
import type { GuidancePattern } from "./config";

/** Marker the model appends to escalate a soft block to a real user prompt. */
const ESCALATION_MARKER = /#\s*guardrails:approve\b[ \t]*(.*)$/im;

export interface Escalation {
  /** Free-text justification the model supplied after the marker. */
  reason: string;
}

/**
 * Detect the escalation marker in a command. Returns the model's stated
 * reason (possibly empty) or null when no marker is present.
 */
export function parseEscalation(command: string): Escalation | null {
  const match = ESCALATION_MARKER.exec(command);
  if (!match) return null;
  return { reason: (match[1] ?? "").trim() };
}

/**
 * Strip the escalation marker so the executed command and session-grant key
 * are stable regardless of the justification text.
 */
export function stripEscalation(command: string): string {
  return command.replace(ESCALATION_MARKER, "").trimEnd();
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
