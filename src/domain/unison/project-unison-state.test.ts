import { projectUnisonState, type UnisonLibraryLyrics } from "@/domain/unison/project-unison-state";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LINKED = { unisonLyricId: "4821", lineCount: 10, syncedLineCount: 10 };

function lyrics(overrides: Partial<UnisonLibraryLyrics> = {}): UnisonLibraryLyrics {
  return { byId: new Map(), complete: true, otherAccountIds: new Set(), unresolvedIds: new Set(), ...overrides };
}

// -- Tests --------------------------------------------------------------------

describe("projectUnisonState", () => {
  it("reads a linked lyric missing from a complete list as removed", () => {
    expect(projectUnisonState(LINKED, lyrics())).toMatchObject({ kind: "linked", status: "removed" });
  });

  describe("regressions", () => {
    it("regression: a lyric owned by another account reads as other account, not removed", () => {
      expect(projectUnisonState(LINKED, lyrics({ otherAccountIds: new Set(["4821"]) }))).toEqual({
        kind: "other-account",
      });
    });

    it("regression: a lyric that could not be looked up reads as unknown, not removed", () => {
      expect(projectUnisonState(LINKED, lyrics({ unresolvedIds: new Set(["4821"]) }))).toEqual({ kind: "unknown" });
    });
  });
});
