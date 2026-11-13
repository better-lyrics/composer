import { describe, expect, it } from "vitest";
import {
  keyedPieces,
  mappedTransliteration,
  mergedPiece,
  positionalPieces,
  regroupedPieces,
} from "@/domain/language/pieces";
import { mergeWordRun } from "@/domain/word/merge-run";
import type { WordTiming } from "@/domain/word/timing";

const word = (id: string, text: string, sep: string, begin: number): WordTiming => ({
  id,
  text,
  sep,
  begin,
  end: begin + 0.4,
  joinsNext: sep === "",
});

const paperLanterns = () => [word("w1", "pa", "", 1), word("w2", "per", " ", 1.4), word("w3", "lanterns", "", 1.8)];

describe("language pieces", () => {
  it("are keyed by syllable id and read back in syllable order", () => {
    const words = paperLanterns();
    const positional = [{ text: "pa", joinerAfter: "-" }, { text: "pe" }, undefined];
    const pieces = keyedPieces(words, positional);
    expect(pieces).toEqual({ w1: { text: "pa", joinerAfter: "-" }, w2: { text: "pe" } });
    expect(positionalPieces(words, pieces)).toEqual(positional);
    expect(keyedPieces(words, [undefined, undefined, undefined])).toBeUndefined();
  });

  it("spell the line's reading only when every syllable has one", () => {
    const words = paperLanterns();
    const partial = { w1: { text: "pa", joinerAfter: "-" }, w2: { text: "pe" } };
    expect(mappedTransliteration(words, partial)).toBeNull();
    expect(mappedTransliteration(words, { ...partial, w3: { text: "rantan" } })).toBe("pa-pe  rantan");
  });

  it("follow a merge onto the merged syllable and keep every other key", () => {
    const words = paperLanterns();
    const pieces = {
      w1: { text: "pa", joinerAfter: "-" },
      w2: { text: "pe", joinerAfter: "  " },
      w3: { text: "rantan" },
    };
    const merged = mergeWordRun(words, [0, 1]) ?? [];
    expect(regroupedPieces(words, merged, pieces)).toEqual({
      w1: { text: "pa-pe", joinerAfter: "  " },
      w3: { text: "rantan" },
    });
  });

  it("of a merged run join with the joiner stored after each piece", () => {
    const words = [word("w1", "a", "", 0), word("w2", "b", "", 1)];
    expect(mergedPiece(words, { w1: { text: "ka", joinerAfter: "-" }, w2: { text: "na" } })?.text).toBe("ka-na");
  });

  it("of a merged run keep the last joiner, and drop the reading when one piece is missing", () => {
    const words = [word("w1", "a", "", 0), word("w2", "b", "", 1), word("w3", "c", " ", 2)];
    const pieces = { w1: { text: "a", joinerAfter: "" }, w2: { text: "bi", joinerAfter: "-" }, w3: { text: "si" } };
    const merged = mergeWordRun(words, [0, 1]) ?? [];
    expect(merged[0]?.joinsNext).toBe(true);
    expect(regroupedPieces(words, merged, pieces)?.w1).toEqual({ text: "abi", joinerAfter: "-" });
    const pair = [word("w1", "a", "", 0), word("w2", "b", " ", 1)];
    const missing = mergeWordRun(pair, [0, 1]) ?? [];
    expect(regroupedPieces(pair, missing, { w1: { text: "a" } })?.w1?.text).toBeUndefined();
  });
});
