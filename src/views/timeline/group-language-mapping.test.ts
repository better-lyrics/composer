/**
 * @vitest-environment node
 */
import { withAlignedTransliteration } from "@/domain/language/align";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { getSplitCharacter } from "@/utils/split-character";
import { conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";
import { fillEmptyLinesWithInstance } from "@/views/timeline/fill-empty-lines-with-instance";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import { beforeEach, describe, expect, it } from "vitest";

function mappedWords(fragments: string[], start: number): WordTiming[] {
  const joiners = ["", "-", "", "  "];
  return fragments.map((transliteration, index) => ({
    text: ["あ", "い", "う", "え ", "お"][index],
    begin: start + index,
    end: start + index + 0.75,
    explicit: true,
    transliteration,
    ...(index < joiners.length ? { transliterationJoinerAfter: joiners[index] } : {}),
  }));
}

function sourceLine(): LyricLine {
  return withDerivedText(
    {
      id: "source",
      agentId: "v1",
      text: "",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      words: mappedWords(["a", "bc", "", "d", "e"], 10),
      backgroundWords: mappedWords(["w", "x", "yz", "", "q"], 11),
      backgroundTextSource: "manual",
      transliteration: {
        text: "abc-d  e",
        backgroundText: "wx-yz  q",
        language: "ja-Latn",
        origin: "manual",
        sourceFingerprint: "source-fingerprint",
        segments: [{ original: "あ", transliteration: "abc" }],
        backgroundSegments: [{ original: "あ", transliteration: "wx" }],
        alignmentStatus: "confirmed",
        backgroundAlignmentStatus: "confirmed",
      },
      translations: {
        en: {
          language: "en",
          text: "Main translation",
          backgroundText: "Background translation",
          origin: "manual",
          sourceFingerprint: "source-fingerprint",
        },
      },
    },
    getSplitCharacter(),
  );
}

function expectExactCopy(copy: LyricLine, source: LyricLine, delta: number) {
  for (const field of ["words", "backgroundWords"] as const) {
    expect(copy[field]).toEqual(
      source[field]?.map((word) => ({ ...word, begin: word.begin + delta, end: word.end + delta })),
    );
    expect(copy[field]).not.toBe(source[field]);
    // Rendering/export must reuse the chosen boundaries, not infer new ones.
    expect(withAlignedTransliteration(copy)[field]).toBe(copy[field]);
  }
  expect(copy.transliteration).toEqual(source.transliteration);
  expect(copy.transliteration).not.toBe(source.transliteration);
  expect(copy.transliteration?.segments).not.toBe(source.transliteration?.segments);
  expect(copy.transliteration?.backgroundSegments).not.toBe(source.transliteration?.backgroundSegments);
  expect(copy.translations).toEqual(source.translations);
  expect(copy.translations?.en).not.toBe(source.translations?.en);
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

describe("linked group alternate-language mappings", () => {
  it("duplicates exact main/background fragments and separators through the real template/store path", () => {
    const source = sourceLine();
    useProjectStore.setState({ lines: [source] });
    const template = instanceToTemplate([source], "g1", 0);
    expect(template[0].transliteration).not.toBe(source.transliteration);
    expect(template[0].translations?.en).not.toBe(source.translations?.en);

    useProjectStore.getState().addInstance("g1", template, 30);
    const copy = useProjectStore.getState().lines[1];
    expect(copy.instanceIdx).toBe(1);
    expectExactCopy(copy, source, 20);
    expect(copy.transliteration).not.toBe(template[0].transliteration);

    if (copy.transliteration) copy.transliteration.segments[0].transliteration = "edited";
    expect(source.transliteration?.segments[0].transliteration).toBe("abc");
    expect(template[0].transliteration?.segments[0].transliteration).toBe("abc");
  });

  it.each(["fill", "conform"] as const)(
    "preserves mappings and clones canonical tracks when applying via %s",
    (operation) => {
      const source = sourceLine();
      const target: LyricLine = {
        id: "target",
        agentId: "v2",
        text: "old content",
        transliteration: { ...source.transliteration!, text: "old romanization" },
        translations: { en: { ...source.translations!.en, text: "old translation" } },
      };
      const input = { lines: [source, target], groupId: "g1", template: instanceToTemplate([source], "g1", 0) };
      const result =
        operation === "fill"
          ? fillEmptyLinesWithInstance({ ...input, startIndex: 1, instanceStart: 30 })
          : conformLinesToInstance({ ...input, selectedLineIds: new Set(["target"]), playheadTime: 30 });
      expect(result.ok).toBe(true);
      expectExactCopy(result.updatedLines![1], source, 20);
      expect(result.updatedLines![0]).toBe(source);
    },
  );

  it("clears destination tracks when the applied template has no alternates", () => {
    const clearWordAlternates = (words?: WordTiming[]) =>
      words?.map(({ transliteration: _text, transliterationJoinerAfter: _joiner, ...word }) => word);
    const original = sourceLine();
    const source = reconcileLine({
      ...original,
      words: clearWordAlternates(original.words)!,
      backgroundWords: clearWordAlternates(original.backgroundWords),
      transliteration: undefined,
      translations: undefined,
    });
    const target = { ...sourceLine(), id: "target", groupId: undefined };
    const result = conformLinesToInstance({
      lines: [source, target],
      groupId: "g1",
      template: instanceToTemplate([source], "g1", 0),
      selectedLineIds: new Set(["target"]),
      playheadTime: 30,
    });
    expect(result.ok).toBe(true);
    expect(result.updatedLines![1].transliteration).toBeUndefined();
    expect(result.updatedLines![1].translations).toBeUndefined();
    expect(result.updatedLines![1].words?.every((word) => word.transliteration === undefined)).toBe(true);
    expect(result.updatedLines![1].backgroundWords?.every((word) => word.transliteration === undefined)).toBe(true);
  });
});
