import { describe, expect, it } from "vitest";
import type { GuidancePattern } from "./config";
import { matchGuidance, parseEscalation, stripEscalation } from "./match";

const patterns: GuidancePattern[] = [
  { pattern: "git checkout", message: "blocked: reverse your own edits" },
  { pattern: "^rm -rf /", message: "blocked: no root wipes", regex: true },
];

describe("matchGuidance", () => {
  it("matches a substring pattern", () => {
    expect(matchGuidance("git checkout main", patterns)).toEqual(patterns[0]);
  });

  it("matches a regex pattern", () => {
    expect(matchGuidance("rm -rf /", patterns)).toEqual(patterns[1]);
  });

  it("returns null when nothing matches", () => {
    expect(matchGuidance("git status", patterns)).toBeNull();
  });

  it("ignores invalid regex without throwing", () => {
    expect(
      matchGuidance("anything", [{ pattern: "(", message: "x", regex: true }]),
    ).toBeNull();
  });
});

describe("parseEscalation", () => {
  it("returns null without a marker", () => {
    expect(parseEscalation("git checkout main")).toBeNull();
  });

  it("extracts the reason after the marker", () => {
    expect(
      parseEscalation(
        "git checkout main # guardrails:approve discarding failed experiment",
      ),
    ).toEqual({ reason: "discarding failed experiment" });
  });

  it("handles a marker with no reason", () => {
    expect(parseEscalation("git checkout main # guardrails:approve")).toEqual({
      reason: "",
    });
  });
});

describe("stripEscalation", () => {
  it("removes the marker and trailing whitespace", () => {
    expect(
      stripEscalation(
        "git checkout main  # guardrails:approve because reasons",
      ),
    ).toBe("git checkout main");
  });

  it("leaves unmarked commands untouched", () => {
    expect(stripEscalation("git checkout main")).toBe("git checkout main");
  });
});
