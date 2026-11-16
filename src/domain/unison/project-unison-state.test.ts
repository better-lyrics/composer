import { projectUnisonState, type UnisonLibraryLyrics } from "@/domain/unison/project-unison-state";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LINKED = { unisonLyricId: "4821", lineCount: 10, syncedLineCount: 10 };

function lyrics(overrides: Partial<UnisonLibraryLyrics> = {}): UnisonLibraryLyrics {
  return { byId: new Map(), complete: true, suggestionIds: new Set(), unresolvedIds: new Set(), ...overrides };
}

// -- Tests --------------------------------------------------------------------

describe("projectUnisonState", () => {
  it("reads a linked lyric missing from a complete list as removed", () => {
    expect(projectUnisonState(LINKED, lyrics())).toMatchObject({ kind: "linked", status: "removed" });
  });

  describe("regressions", () => {
    it("regression: a linked lyric owned by someone else reads as a suggestion, not removed or unknown", () => {
      const suggestionIds = new Set(["4821"]);
      expect(projectUnisonState(LINKED, lyrics({ suggestionIds }))).toEqual({ kind: "suggestion" });
      expect(projectUnisonState(LINKED, lyrics({ complete: false, suggestionIds }))).toEqual({ kind: "suggestion" });
    });

    it("regression: a lyric that could not be looked up reads as unknown, not removed", () => {
      expect(projectUnisonState(LINKED, lyrics({ unresolvedIds: new Set(["4821"]) }))).toEqual({ kind: "unknown" });
    });
  });
});
