import { describe, expect, it } from "vitest";
import { formatScore, unisonStatus } from "@/domain/unison/lyric-status";

// -- Fixtures ------------------------------------------------------------------

const LIVE = { hidden: false, marks: [], revision: { pending: null, lastRejected: null } };
const PENDING = { revNo: 4 };
const REJECTED = { revNo: 3, reviewNote: "Timing drifts in the chorus." };
const SEAL = [{ type: "seal" }];

// -- Tests ---------------------------------------------------------------------

describe("unisonStatus", () => {
  it("reads each state", () => {
    expect(unisonStatus(null)).toBe("removed");
    expect(unisonStatus(LIVE)).toBe("live");
    expect(unisonStatus({ ...LIVE, marks: SEAL })).toBe("sealed");
    expect(unisonStatus({ ...LIVE, hidden: true })).toBe("hidden");
    expect(unisonStatus({ ...LIVE, revision: { pending: PENDING, lastRejected: null } })).toBe("pending");
    expect(unisonStatus({ ...LIVE, revision: { pending: null, lastRejected: REJECTED } })).toBe("declined");
  });

  describe("invariants", () => {
    it("orders pending before declined, declined before hidden, hidden before sealed", () => {
      expect(unisonStatus({ hidden: true, marks: SEAL, revision: { pending: PENDING, lastRejected: REJECTED } })).toBe(
        "pending",
      );
      expect(unisonStatus({ hidden: true, marks: SEAL, revision: { pending: null, lastRejected: REJECTED } })).toBe(
        "declined",
      );
      expect(unisonStatus({ hidden: true, marks: SEAL })).toBe("hidden");
    });
  });

  describe("edge cases", () => {
    it("reads a lyric without revision or marks as live", () => {
      expect(unisonStatus({ hidden: false })).toBe("live");
    });

    it("ignores marks other than the seal", () => {
      expect(unisonStatus({ hidden: false, marks: [{ type: "badge" }] })).toBe("live");
    });
  });
});

describe("formatScore", () => {
  it("signs positive scores and leaves zero and negatives as they are", () => {
    expect(formatScore(41)).toBe("+41");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(-2)).toBe("-2");
  });
});
