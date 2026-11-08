import { describe, expect, it } from "vitest";
import { unisonStatus } from "@/domain/unison/lyric-status";

// -- Fixtures ------------------------------------------------------------------

const PENDING = { revNo: 4 };
const REJECTED = { revNo: 3, reviewNote: "Timing drifts in the chorus." };
const SEAL = [{ type: "seal" }];

// -- Tests ---------------------------------------------------------------------

describe("unisonStatus", () => {
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
});
