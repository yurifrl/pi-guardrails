/**
 * Standalone config for the `guidance` extension.
 *
 * Kept intentionally decoupled from the guardrails config so upstream
 * rebases never touch this feature. Uses the shared ConfigLoader only for
 * scope resolution and merging.
 *
 * Global: ~/.pi/agent/extensions/guidance.json
 * Local:  {project}/.pi/extensions/guidance.json
 */
import { ConfigLoader } from "@aliou/pi-utils-settings";

/**
 * A soft-block rule. When a bash command matches `pattern`, the call is
 * blocked without prompting and `message` is returned verbatim to the model.
 * The model can escalate to a real user prompt by re-running the command with
 * a trailing `# guardrails:approve <reason>` marker.
 */
export interface GuidancePattern {
  /** Matched against the raw command string. Substring by default. */
  pattern: string;
  /** Returned verbatim to the model when the pattern matches. */
  message: string;
  /** When true, `pattern` is treated as a full regular expression. */
  regex?: boolean;
}

export interface GuidanceConfig {
  $schema?: string;
  /** Enable or disable all guidance checks. Default true. */
  enabled?: boolean;
  /** Soft-block-with-message rules. */
  patterns?: GuidancePattern[];
}

export interface ResolvedGuidanceConfig {
  enabled: boolean;
  patterns: GuidancePattern[];
}

const DEFAULT_CONFIG: ResolvedGuidanceConfig = {
  enabled: true,
  patterns: [],
};

/** Concatenate pattern arrays across scopes (global -> local -> memory). */
function concatPatterns(
  ...configs: Array<GuidanceConfig | null>
): GuidancePattern[] {
  const out: GuidancePattern[] = [];
  for (const config of configs) {
    for (const entry of config?.patterns ?? []) {
      if (!entry || typeof entry !== "object") continue;
      const pattern = typeof entry.pattern === "string" ? entry.pattern : "";
      const message = typeof entry.message === "string" ? entry.message : "";
      if (!pattern || !message) continue;
      out.push({ pattern, message, regex: entry.regex === true });
    }
  }
  return out;
}

export function createGuidanceConfigLoader(): ConfigLoader<
  GuidanceConfig,
  ResolvedGuidanceConfig
> {
  return new ConfigLoader<GuidanceConfig, ResolvedGuidanceConfig>(
    "guidance",
    DEFAULT_CONFIG,
    {
      scopes: ["global", "local", "memory"],
      afterMerge: (resolved, global, local, memory) => {
        resolved.patterns = concatPatterns(global, local, memory);
        return resolved;
      },
    },
  );
}

export const configLoader = createGuidanceConfigLoader();
