/**
 * guidance extension
 *
 * Soft-blocks bash commands that match configured patterns and returns a
 * guidance message to the model instead of prompting the user. The model can
 * escalate to a real user approval prompt by re-running the command with a
 * trailing `# guardrails:approve <reason>` marker.
 *
 * Fully self-contained: no imports from upstream `src/` or sibling extensions,
 * so it survives upstream rebases untouched.
 */
import {
  type ExtensionAPI,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import { configLoader } from "./config";
import { matchGuidance, parseEscalation, stripEscalation } from "./match";

export default async function guidance(pi: ExtensionAPI) {
  await configLoader.load();

  // Commands approved "for session" (marker-stripped), skipped on later calls.
  const sessionAllowed = new Set<string>();

  pi.on("tool_call", async (event, ctx) => {
    const config = configLoader.getConfig();
    if (!config.enabled || config.patterns.length === 0) return;
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    const match = matchGuidance(command, config.patterns);
    if (!match) return;

    const baseCommand = stripEscalation(command);
    if (sessionAllowed.has(baseCommand)) return;

    const escalation = parseEscalation(command);

    // No escalation marker: soft block with the guidance message, no prompt.
    if (!escalation) {
      return { block: true, reason: match.message };
    }

    // Escalation requested but there is no UI to ask the user.
    if (!ctx.hasUI) {
      return {
        block: true,
        reason: `${match.message}\n\n(Escalation requested but no interactive UI is available to approve it.)`,
      };
    }

    const detail = escalation.reason
      ? `${baseCommand}\n\nModel's reason: ${escalation.reason}`
      : baseCommand;

    const selection = await ctx.ui.select(
      `Guidance escalation — approve this command?\n${detail}`,
      ["Allow once", "Allow for session", "Deny", "Decline and stop"],
    );

    if (selection === "Allow once") return;
    if (selection === "Allow for session") {
      sessionAllowed.add(baseCommand);
      return;
    }
    if (selection === "Decline and stop") {
      ctx.abort();
      return { block: true, reason: "User declined and stopped the command." };
    }
    return { block: true, reason: match.message };
  });
}
