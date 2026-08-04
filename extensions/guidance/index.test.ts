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
import guidance from "./index";

vi.mock("./config", () => {
  return {
    configLoader: {
      load: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn(() => ({
        enabled: true,
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
    ui: {
      custom: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockResolvedValue(undefined),
      notify: vi.fn(),
    },
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

  it("soft-blocks a matching command with the verbatim message", async () => {
    assert(handler);
    const result = await handler(bashEvent("git checkout main"), createCtx());
    expect(result).toEqual({
      block: true,
      reason: "GUIDANCE: reverse your edits",
    });
  });

  it("blocks escalation when no UI is available", async () => {
    assert(handler);
    const ctx = createCtx({ hasUI: false });
    const result = await handler(
      bashEvent("git checkout main # guardrails:approve because reasons"),
      ctx,
    );
    assert(result && "block" in result);
    expect(result.block).toBe(true);
    expect(result.reason).toContain("GUIDANCE: reverse your edits");
    expect(result.reason).toContain("no interactive UI");
  });

  it("allows once when the user approves the escalation", async () => {
    assert(handler);
    const ctx = createCtx({
      ui: { select: vi.fn().mockResolvedValue("Allow once"), notify: vi.fn() },
    });
    const result = await handler(
      bashEvent("git checkout main # guardrails:approve need it"),
      ctx,
    );
    expect(result).toBeUndefined();
  });

  it("allows subsequent identical commands after Allow for session", async () => {
    assert(handler);
    const ctx = createCtx({
      ui: {
        select: vi.fn().mockResolvedValue("Allow for session"),
        notify: vi.fn(),
      },
    });
    expect(
      await handler(bashEvent("git checkout main # guardrails:approve x"), ctx),
    ).toBeUndefined();
    // A later plain call to the same base command is allowed without prompting.
    const plainCtx = createCtx();
    expect(
      await handler(bashEvent("git checkout main"), plainCtx),
    ).toBeUndefined();
    expect(plainCtx.ui.select).not.toHaveBeenCalled();
  });

  it("re-blocks with the guidance message on Deny", async () => {
    assert(handler);
    const ctx = createCtx({
      ui: { select: vi.fn().mockResolvedValue("Deny"), notify: vi.fn() },
    });
    const result = await handler(
      bashEvent("git checkout main # guardrails:approve nope"),
      ctx,
    );
    expect(result).toEqual({
      block: true,
      reason: "GUIDANCE: reverse your edits",
    });
  });

  it("aborts the turn on Decline and stop", async () => {
    assert(handler);
    const ctx = createCtx({
      ui: {
        select: vi.fn().mockResolvedValue("Decline and stop"),
        notify: vi.fn(),
      },
    });
    const result = await handler(
      bashEvent("git checkout main # guardrails:approve stop"),
      ctx,
    );
    assert(result && "block" in result);
    expect(result.block).toBe(true);
    expect(ctx.abort).toHaveBeenCalled();
  });
});
