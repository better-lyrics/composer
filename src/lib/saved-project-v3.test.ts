import { roleWords } from "insync/line-track";
import { backgroundText, lineText } from "insync/line-text";
import { pieceOf, trackPieces } from "insync/language-pieces";
import { linesFromSavedV3, type SavedLineV3 } from "@/lib/saved-project-v3";
import { savedLinesV3 } from "@/test/saved-v3";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

describe("linesFromSavedV3", () => {
  it("gives loaded words new ids even when the file carries some", () => {
    const [line] = linesFromSavedV3([
      {
        id: "line-1",
        text: "Paper lanterns",
        agentId: "v1",
        words: [
          { id: "x", text: "Paper ", begin: 1, end: 2 },
          { id: "x", text: "lanterns", begin: 2, end: 3 },
        ],
      },
    ]);
    const ids = roleWords(line, "main")?.map((word) => word.id) ?? [];
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain("x");
  });

  it("regression: puts back syllable marks the saved text lost and keeps them on the next load", () => {
    const [line] = linesFromSavedV3([
      {
        id: "line-1",
        text: "Paper lanterns",
        agentId: "v1",
        words: [
          { text: "Pa", begin: 1, end: 1.2 },
          { text: "per ", begin: 1.2, end: 1.6 },
          { text: "lanterns", begin: 1.6, end: 2.2 },
        ],
        backgroundText: "drifting",
        backgroundWords: [
          { text: "drif", begin: 2.2, end: 2.5 },
          { text: "ting", begin: 2.5, end: 2.9 },
        ],
      },
    ]);
    expect(lineText(line, DEFAULT_SPLIT_CHARACTER)).toBe("Pa|per lanterns");
    expect(backgroundText(line, DEFAULT_SPLIT_CHARACTER)).toBe("drif|ting");
    const [reloaded] = linesFromSavedV3(savedLinesV3([line]));
    expect([lineText(reloaded, DEFAULT_SPLIT_CHARACTER), backgroundText(reloaded, DEFAULT_SPLIT_CHARACTER)]).toEqual([
      "Pa|per lanterns",
      "drif|ting",
    ]);
  });

  it("regression: a partly synced line's last timed syllable joins the untimed part after it", () => {
    const [line] = linesFromSavedV3([
      {
        id: "line-1",
        text: "hel|lo you",
        agentId: "v1",
        words: [{ text: "hel", begin: 1, end: 1.3 }],
        backgroundText: "o|oh yeah",
        backgroundWords: [{ text: "o", begin: 1, end: 1.2 }],
      },
    ]);
    expect(roleWords(line, "main")?.map((word) => word.joinsNext)).toEqual([true]);
    expect(roleWords(line, "bg")?.map((word) => word.joinsNext)).toEqual([true]);
  });

  it("keeps a line's languages and syllable readings where a version 3 record spells them", () => {
    const saved: SavedLineV3 = {
      id: "line-1",
      text: "Paper lanterns",
      agentId: "v1",
      words: [
        { text: "Paper ", begin: 1, end: 1.6, transliteration: "pēpā", transliterationJoinerAfter: "  " },
        { text: "lanterns", begin: 1.6, end: 2.2, transliteration: "rantan" },
      ],
      backgroundText: "drifting",
      backgroundWords: [{ text: "drifting", begin: 2.2, end: 2.9, transliteration: "dorifuto" }],
      translations: {
        fr: { language: "fr", text: "Lanternes", backgroundText: "flottant", origin: "manual", sourceFingerprint: "a" },
      },
      transliteration: {
        language: "ja-Latn",
        text: "pēpā  rantan",
        backgroundText: "dorifuto",
        segments: [{ original: "Paper lanterns", transliteration: "pēpā  rantan" }],
        backgroundSegments: [{ original: "drifting", transliteration: "dorifuto" }],
        alignmentStatus: "confirmed",
        backgroundAlignmentStatus: "inferred",
        reviewedSourceFingerprint: "b",
        origin: "manual",
        sourceFingerprint: "a",
      },
    };
    const [line] = linesFromSavedV3([saved]);
    const firstWord = roleWords(line, "main")?.[0];
    expect(firstWord && pieceOf(trackPieces(line, "main"), firstWord)).toEqual({ text: "pēpā", joinerAfter: "  " });
    expect(line.languages?.transliteration?.bg?.alignmentStatus).toBe("inferred");
    expect(savedLinesV3([line])).toEqual([saved]);
  });

  it("keeps syllable readings a version 3 record holds without a romanization side for them", () => {
    const withoutRomanization: SavedLineV3 = {
      id: "line-1",
      text: "Paper",
      agentId: "v1",
      words: [{ text: "Paper", begin: 1, end: 1.6, transliteration: "pēpā" }],
    };
    const withoutBackground: SavedLineV3 = {
      id: "line-2",
      text: "lanterns",
      agentId: "v1",
      words: [{ text: "lanterns", begin: 2, end: 2.6, transliteration: "rantan" }],
      backgroundText: "drifting",
      backgroundWords: [{ text: "drifting", begin: 2.6, end: 3, transliteration: "dorifuto" }],
      transliteration: { language: "ja-Latn", text: "rantan", origin: "manual", sourceFingerprint: "a" },
    };
    expect(savedLinesV3(linesFromSavedV3([withoutRomanization, withoutBackground]))).toEqual([
      withoutRomanization,
      withoutBackground,
    ]);
  });
});
