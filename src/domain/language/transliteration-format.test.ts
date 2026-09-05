import {
  normalizeTransliterationForEditing,
  splitTransliterationAtBoundaries,
  timedTransliterationSlice,
  timingLexicalWordGroups,
  transliterationPronunciationParts,
  transliterationWordGroups,
} from "@/domain/language/transliteration-format";
import { describe, expect, it } from "vitest";

describe("transliteration display format", () => {
  it("preserves one and two spaces while capping wider runs", () => {
    expect(normalizeTransliterationForEditing("  but eoissdeon   daeum ")).toBe("but eoissdeon  daeum");
  });

  it("uses double spaces for romanized words and single spaces for pronunciation parts", () => {
    const text = "but eoissdeon  daeum";
    expect(transliterationWordGroups(text)).toEqual(["but eoissdeon", "daeum"]);
    expect(transliterationPronunciationParts(text)).toEqual(["but", "eoissdeon", "daeum"]);
  });

  it("preserves exact separator joiners in stored alignment slices", () => {
    expect(splitTransliterationAtBoundaries("but eo-issdeon", [4, 7])).toEqual([
      { text: "but", joinerAfter: " " },
      { text: "eo", joinerAfter: "-" },
      { text: "issdeon" },
    ]);
  });

  it.each(["-", "‐", "‑", "‒", "–", "—", "―", "--", " –  "])(
    "assigns the visible %j separator to the preceding timed slice without changing storage",
    (joinerAfter) => {
      const stored = { text: "to", joinerAfter };
      const timed = timedTransliterationSlice(stored);
      expect(timed.text).toBe(`to${joinerAfter.trimEnd()}`);
      expect(timed.text + timed.joinerAfter).toBe(`to${joinerAfter}`);
      expect(timedTransliterationSlice(timed)).toEqual(timed);
      expect(stored).toEqual({ text: "to", joinerAfter });
    },
  );

  it("leaves gaps untimed and does not duplicate dashes already in a timed fragment", () => {
    for (const joinerAfter of ["", " ", "  "]) {
      expect(timedTransliterationSlice({ text: "to-", joinerAfter })).toEqual({ text: "to-", joinerAfter });
    }
  });

  it("preserves already-visible edge dashes only when explicitly editing an existing alignment", () => {
    expect(splitTransliterationAtBoundaries("-to-do-", [3])).toEqual([
      { text: "to", joinerAfter: "-" },
      { text: "do" },
    ]);
    expect(splitTransliterationAtBoundaries("-to-do-", [3], { preserveEdgeDashes: true })).toEqual([
      { text: "-to", joinerAfter: "-" },
      { text: "do-" },
    ]);
    expect(splitTransliterationAtBoundaries("-", [], { preserveEdgeDashes: true })).toEqual([{ text: "-" }]);
  });

  it("uses source spaces rather than syllable group IDs as lexical boundaries", () => {
    const groups = timingLexicalWordGroups([
      { text: "風", begin: 0, end: 1, syllableGroupId: "first" },
      { text: "は ", begin: 1, end: 2, syllableGroupId: "second" },
      { text: "強", begin: 2, end: 3, syllableGroupId: "second" },
      { text: "い", begin: 3, end: 4, syllableGroupId: "third" },
    ]);
    expect(groups.map((group) => group.words.map((word) => word.text).join(""))).toEqual(["風は ", "強い"]);
  });
});
