import { describe, expect, it } from "vitest";
import type { GuidancePattern } from "./config";
import { matchGuidance, wantsToProceed } from "./match";

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

describe("wantsToProceed", () => {
  it("is false without the marker", () => {
    expect(wantsToProceed("git checkout main")).toBe(false);
  });

  it("is true with the marker", () => {
    expect(
      wantsToProceed("git checkout main # guardrails:approve discarding work"),
    ).toBe(true);
  });

  it("is true with the marker and no reason", () => {
    expect(wantsToProceed("git checkout main # guardrails:approve")).toBe(true);
  });
});
