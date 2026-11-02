import { type LastSeen, type UnisonMineSnapshot, lastSeenFrom, updatesSince } from "@/domain/unison/updates-since";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function mine(id: number, overrides: Partial<UnisonMineSnapshot["revision"]> & { hidden?: boolean } = {}) {
  const { hidden = false, ...revision } = overrides;
  return {
    id,
    hidden,
    revision: { revNo: 1, pending: null, lastRejected: null, updatedAt: 1_700_000_000, ...revision },
  } satisfies UnisonMineSnapshot;
}

const SEEN: LastSeen = {
  "1": { revNo: 1, pendingRevNo: 2, rejectedRevNo: null, hidden: false },
  "2": { revNo: 3, pendingRevNo: null, rejectedRevNo: 2, hidden: false },
};

// -- Tests --------------------------------------------------------------------

describe("updatesSince", () => {
  it("reports a higher live revision as an approved edit", () => {
    expect(updatesSince(SEEN, [mine(1, { revNo: 2, updatedAt: 50 })])).toEqual([
      { lyricId: "1", kind: "approved", revNo: 2, at: 50, reviewNote: null },
    ]);
  });

  it("reports a new rejected revision as a declined edit with its note", () => {
    const declined = mine(1, { lastRejected: { revNo: 2, reviewNote: "Timing drifts" }, updatedAt: 60 });
    expect(updatesSince(SEEN, [declined])).toEqual([
      { lyricId: "1", kind: "declined", revNo: 2, at: 60, reviewNote: "Timing drifts" },
    ]);
  });

  it("reports a lyric that became hidden", () => {
    expect(updatesSince(SEEN, [mine(1, { hidden: true, updatedAt: 70 })])).toEqual([
      { lyricId: "1", kind: "hidden", revNo: 1, at: 70, reviewNote: null },
    ]);
  });

  it("reports several updates, newest first", () => {
    const updates = updatesSince(SEEN, [
      mine(1, { revNo: 2, updatedAt: 10 }),
      mine(2, { revNo: 3, lastRejected: { revNo: 4, reviewNote: null }, hidden: true, updatedAt: 20 }),
    ]);
    expect(updates.map((update) => [update.lyricId, update.kind])).toEqual([
      ["2", "declined"],
      ["2", "hidden"],
      ["1", "approved"],
    ]);
  });

  describe("edge cases", () => {
    it("reports nothing on a first visit", () => {
      expect(updatesSince(null, [mine(1, { revNo: 5, hidden: true })])).toEqual([]);
    });

    it("reports nothing for a lyric missing from the current list", () => {
      expect(updatesSince(SEEN, [])).toEqual([]);
    });

    it("reports nothing for a lyric that was not in the snapshot", () => {
      expect(updatesSince(SEEN, [mine(9, { revNo: 4, hidden: true })])).toEqual([]);
    });

    it("reports nothing when a lyric is unchanged", () => {
      expect(
        updatesSince(SEEN, [mine(1), mine(2, { revNo: 3, lastRejected: { revNo: 2, reviewNote: null } })]),
      ).toEqual([]);
    });

    it("does not report a lyric that stayed hidden or became visible again", () => {
      const seen: LastSeen = { "1": { revNo: 1, pendingRevNo: null, rejectedRevNo: null, hidden: true } };
      expect(updatesSince(seen, [mine(1, { hidden: true })])).toEqual([]);
      expect(updatesSince(seen, [mine(1)])).toEqual([]);
    });
  });

  describe("regressions", () => {
    it("regression: an edit that went live without review is not reported as approved", () => {
      expect(updatesSince(SEEN, [mine(2, { revNo: 4, lastRejected: { revNo: 2, reviewNote: null } })])).toEqual([]);
    });

    it("regression: a pending edit replaced by a later one still reads as approved once live", () => {
      expect(updatesSince(SEEN, [mine(1, { revNo: 3 })]).map((update) => update.kind)).toEqual(["approved"]);
    });
  });

  describe("invariants", () => {
    it("never reports the same revision twice once the snapshot is written", () => {
      const current = [
        mine(1, { revNo: 2 }),
        mine(2, { revNo: 3, lastRejected: { revNo: 5, reviewNote: "No" }, hidden: true }),
      ];
      expect(updatesSince(SEEN, current)).not.toEqual([]);
      expect(updatesSince(lastSeenFrom(current, SEEN), current)).toEqual([]);
    });
  });
});

describe("lastSeenFrom", () => {
  it("records the live revision, the last rejected revision and visibility", () => {
    expect(
      lastSeenFrom([
        mine(4, { revNo: 7, pending: { revNo: 9 }, lastRejected: { revNo: 8, reviewNote: null }, hidden: true }),
      ]),
    ).toEqual({
      "4": { revNo: 7, pendingRevNo: 9, rejectedRevNo: 8, hidden: true },
    });
  });

  it("keeps earlier entries for lyrics that were not loaded this time", () => {
    expect(lastSeenFrom([mine(1, { revNo: 2 })], SEEN)).toEqual({
      "1": { revNo: 2, pendingRevNo: null, rejectedRevNo: null, hidden: false },
      "2": SEEN["2"],
    });
  });

  it("never mutates the previous snapshot", () => {
    const previous = structuredClone(SEEN);
    lastSeenFrom([mine(1, { revNo: 9 })], previous);
    expect(previous).toEqual(SEEN);
  });
});
