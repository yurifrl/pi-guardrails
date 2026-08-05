/**
 * guidance extension
 *
 * A front layer over the existing block / ask-permission gates. When a bash
 * command matches a configured pattern, guidance is returned to the model and
 * nothing runs. If the model acknowledges and wants to proceed, it re-runs the
 * command with a trailing `# guardrails:approve <reason>` marker; guidance then
 * steps aside so the command reaches the real gate (permission-gate), which
 * blocks or asks for confirmation as configured.
 *
 * Fully self-contained: no imports from upstream `src/` or sibling extensions,
 * so it survives upstream rebases untouched.
 */
import {
  type ExtensionAPI,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import { configLoader } from "./config";
import { matchGuidance, wantsToProceed } from "./match";

export default async function guidance(pi: ExtensionAPI) {
  await configLoader.load();

  pi.on("tool_call", async (event) => {
    const config = configLoader.getConfig();
    if (!config.enabled || config.patterns.length === 0) return;
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    const match = matchGuidance(command, config.patterns);
    if (!match) return;

    // Model acknowledged the guidance: step aside so the real gate
    // (permission-gate) decides whether to block or ask for confirmation.
    if (wantsToProceed(command)) return;

    // First attempt: return guidance, run nothing, do not prompt the user.
    const hint = config.proceedHint.trim();
    const reason = hint
      ? `${match.message}

${hint}`
      : match.message;
    return { block: true, reason };
  });
}
