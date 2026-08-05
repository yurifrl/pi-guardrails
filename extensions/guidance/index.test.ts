import type {
  BashToolCallEvent,
  ExtensionAPI,
  ExtensionContext,
  ExtensionHandler,
  ReadToolCallEvent,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import {
  createMock,
  type DeepMocked,
  type PartialFuncReturn,
} from "@golevelup/ts-vitest";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { configLoader } from "./config";
import guidance from "./index";

vi.mock("./config", () => {
  return {
    configLoader: {
      load: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn(() => ({
        enabled: true,
        proceedHint: "PROCEED_HINT",
        patterns: [
          { pattern: "git checkout", message: "GUIDANCE: reverse your edits" },
        ],
      })),
    },
  };
});

type ToolCallHandler = ExtensionHandler<ToolCallEvent, ToolCallEventResult>;

function registeredToolCallHandler(pi: DeepMocked<ExtensionAPI>) {
  const calls: unknown[][] = pi.on.mock.calls;
  return calls.find(([event]) => event === "tool_call")?.[1] as
    | ToolCallHandler
    | undefined;
}

function createCtx(overrides: PartialFuncReturn<ExtensionContext> = {}) {
  return createMock<ExtensionContext>({
    hasUI: true,
    mode: "tui",
    ui: { custom: vi.fn(), select: vi.fn(), notify: vi.fn() },
    abort: vi.fn(),
    ...overrides,
  });
}

function bashEvent(command: string): BashToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "call",
    toolName: "bash",
    input: { command },
  };
}

describe("guidance extension hook", () => {
  let pi: DeepMocked<ExtensionAPI>;
  let handler: ToolCallHandler | undefined;

  beforeEach(async () => {
    pi = createMock<ExtensionAPI>();
    await guidance(pi);
    handler = registeredToolCallHandler(pi);
  });

  it("passes non-matching commands", async () => {
    assert(handler);
    expect(await handler(bashEvent("git status"), createCtx())).toBeUndefined();
  });

  it("passes non-bash tools", async () => {
    assert(handler);
    const event = {
      type: "tool_call",
      toolCallId: "read-call",
      toolName: "read",
      input: { path: "git checkout" },
    } satisfies ReadToolCallEvent;
    expect(await handler(event, createCtx())).toBeUndefined();
  });

  it("returns the guidance with the proceed hint appended on the first attempt", async () => {
    assert(handler);
    const result = await handler(bashEvent("git checkout main"), createCtx());
    expect(result).toEqual({
      block: true,
      reason: "GUIDANCE: reverse your edits\n\nPROCEED_HINT",
    });
  });

  it("steps aside when the model passes the proceed marker", async () => {
    assert(handler);
    const result = await handler(
      bashEvent("git checkout main # guardrails:approve discarding experiment"),
      createCtx(),
    );
    expect(result).toBeUndefined();
  });

  it("omits the hint when proceedHint is empty", async () => {
    vi.mocked(configLoader.getConfig).mockReturnValueOnce({
      enabled: true,
      proceedHint: "",
      patterns: [{ pattern: "git checkout", message: "BARE" }],
    });
    assert(handler);
    const result = await handler(bashEvent("git checkout main"), createCtx());
    expect(result).toEqual({ block: true, reason: "BARE" });
  });
});
