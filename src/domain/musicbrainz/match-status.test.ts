import { describe, expect, it } from "vitest";
import { type LookupProgress, waitingStatus } from "@/domain/musicbrainz/match-status";

const song = { title: "Your Power", artist: "Billie Eilish", isrc: null };

function progress(patch: Partial<LookupProgress> = {}): LookupProgress {
  return {
    mode: "auto",
    requested: false,
    live: song,
    searched: song,
    showingPreviousResults: false,
    knownIsrcs: ["USUM72105934"],
    ...patch,
  };
}

describe("waitingStatus", () => {
  it("lets a settled search through", () => {
    expect(waitingStatus(progress())).toBeNull();
  });

  it("waits while the title or artist is still being typed", () => {
    expect(waitingStatus(progress({ live: { ...song, title: "Your Powe" } }))).toBe("searching");
  });

  describe("edge cases", () => {
    it("reports off, a missing title and an unrequested manual lookup", () => {
      expect(waitingStatus(progress({ mode: "off" }))).toBe("off");
      expect(waitingStatus(progress({ live: { ...song, title: "" } }))).toBe("missing-title");
      expect(waitingStatus(progress({ mode: "manual" }))).toBe("idle");
      expect(waitingStatus(progress({ mode: "manual", requested: true }))).toBeNull();
    });

    it("keeps the match when the new ISRC belongs to it, as after Fill", () => {
      const filled = { ...song, isrc: "USUM72105934" };
      expect(waitingStatus(progress({ live: filled }))).toBeNull();
      expect(waitingStatus(progress({ live: filled, searched: filled, showingPreviousResults: true }))).toBeNull();
    });
  });

  describe("regressions", () => {
    it("regression: waits instead of offering the old recording after a different ISRC is typed", () => {
      const other = { ...song, isrc: "USUM72199999" };
      expect(waitingStatus(progress({ live: other }))).toBe("searching");
      expect(waitingStatus(progress({ live: other, searched: other, showingPreviousResults: true }))).toBe("searching");
    });
  });
});
