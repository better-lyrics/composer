import { setBackground } from "@/domain/line/background";
import { mainBounds } from "@/domain/line/bounds";
import { reconcileLine } from "@/domain/line/model";
import { placeVoice } from "@/domain/line/place-voice";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import { isLineSynced, isUntimed } from "@/domain/voice/predicates";
import { describe, expect, it } from "vitest";

// -- Constants -----------------------------------------------------------------

const DUR = 0.3;

// -- Helpers -------------------------------------------------------------------

function untimedLine(text: string): ReturnType<typeof reconcileLine> {
  return reconcileLine({ id: "l1", text, agentId: "v1" });
}

// -- Tests ---------------------------------------------------------------------

describe("placeVoice", () => {
  describe("main", () => {
    it("places a multi-word line as main line-synced over max(wordCount,1)*dur", () => {
      const line = untimedLine("hello there world");
      const placed = placeVoice(line, "main", 5, DUR);
      const bounds = mainBounds(placed);
      expect(bounds?.begin).toBeCloseTo(5, 9);
      expect(bounds?.end).toBeCloseTo(5 + 3 * DUR, 9);
      expect(isLineSynced(mainVoice(placed))).toBe(true);
    });

    it("treats an empty-text line as one word (max(0,1)=1)", () => {
      const line = untimedLine("");
      const placed = placeVoice(line, "main", 2, DUR);
      const bounds = mainBounds(placed);
      expect(bounds?.begin).toBeCloseTo(2, 9);
      expect(bounds?.end).toBeCloseTo(2 + DUR, 9);
      expect(isLineSynced(mainVoice(placed))).toBe(true);
    });

    it("does not create a background when none exists", () => {
      const placed = placeVoice(untimedLine("a b"), "main", 0, DUR);
      expect(bgVoice(placed)).toBeNull();
    });

    it("preserves an existing line-synced background (durability parity)", () => {
      const base = reconcileLine({ id: "l1", text: "lead vocals", agentId: "v1" });
      const withBg = setBackground(base, { text: "echo echo", begin: 10, end: 12, source: "manual" });
      const placed = placeVoice(withBg, "main", 3, DUR);

      const bg = bgVoice(placed);
      expect(bg).not.toBeNull();
      expect(bg && isLineSynced(bg)).toBe(true);
      const bounds = bg && isLineSynced(bg) ? { begin: bg.begin, end: bg.end } : null;
      expect(bounds?.begin).toBeCloseTo(10, 9);
      expect(bounds?.end).toBeCloseTo(12, 9);
    });
  });

  describe("background", () => {
    it("places an untimed bg text as a line-synced background over max(wordCount,1)*dur", () => {
      const base = reconcileLine({ id: "l1", text: "lead", agentId: "v1", backgroundText: "oh oh oh" });
      const placed = placeVoice(base, "background", 7, DUR);

      const bg = bgVoice(placed);
      expect(bg).not.toBeNull();
      expect(bg && isLineSynced(bg)).toBe(true);
      const bounds = bg && isLineSynced(bg) ? { begin: bg.begin, end: bg.end } : null;
      expect(bounds?.begin).toBeCloseTo(7, 9);
      expect(bounds?.end).toBeCloseTo(7 + 3 * DUR, 9);
      expect(bg?.source).toBe("manual");
    });

    it("leaves the main voice untouched when placing the background", () => {
      const base = reconcileLine({ id: "l1", text: "lead", agentId: "v1", backgroundText: "oh oh" });
      const placed = placeVoice(base, "background", 7, DUR);
      expect(isUntimed(mainVoice(placed))).toBe(true);
      expect(mainBounds(placed)).toBeNull();
    });

    it("is a no-op when there is no background text", () => {
      const line = untimedLine("lead vocals");
      const placed = placeVoice(line, "background", 4, DUR);
      expect(placed).toEqual(line);
      expect(bgVoice(placed)).toBeNull();
    });

    it("treats an empty bg text as no background (no-op)", () => {
      const base = reconcileLine({ id: "l1", text: "lead", agentId: "v1", backgroundText: "" });
      const placed = placeVoice(base, "background", 4, DUR);
      expect(placed).toEqual(base);
    });
  });

  describe("invariants", () => {
    it("main and background placements produce identical begin/end math for equal word counts", () => {
      const mainLine = untimedLine("one two three");
      const bgLine = reconcileLine({ id: "l2", text: "lead", agentId: "v1", backgroundText: "a b c" });

      const placedMain = placeVoice(mainLine, "main", 9, DUR);
      const placedBg = placeVoice(bgLine, "background", 9, DUR);

      const mainEnd = mainBounds(placedMain)?.end;
      const bg = bgVoice(placedBg);
      const bgEnd = bg && isLineSynced(bg) ? bg.end : undefined;
      expect(bgEnd).toBeCloseTo(mainEnd ?? Number.NaN, 9);
    });

    it("does not mutate the input line (main)", () => {
      const line = untimedLine("hello world");
      const snapshot = structuredClone(line);
      placeVoice(line, "main", 5, DUR);
      expect(line).toEqual(snapshot);
    });

    it("does not mutate the input line (background)", () => {
      const line = reconcileLine({ id: "l1", text: "lead", agentId: "v1", backgroundText: "echo" });
      const snapshot = structuredClone(line);
      placeVoice(line, "background", 5, DUR);
      expect(line).toEqual(snapshot);
    });
  });
});
