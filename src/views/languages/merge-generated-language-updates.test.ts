/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { saveTransliterationAlignment } from "@/domain/commands/languages";
import { moveWords } from "@/domain/commands/word-moves";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup } from "@/test/factories";
import { legacyLine } from "@/test/legacy-languages";
import { watchGenerationEdits } from "@/views/languages/generation-edit-guard";
import { mergeGeneratedLanguageUpdates } from "@/views/languages/merge-generated-language-updates";

function chorusLine(id: string, instanceIdx: number, begin: number, reading: string) {
  return legacyLine({
    id,
    agentId: "v1",
    text: "하늘",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { id: `${id}-w`, text: "하늘", sep: "", begin, end: begin + 1, transliteration: reading, joinsNext: false },
    ],
    transliteration: {
      language: "ko-Latn",
      text: "haneul",
      segments: [],
      origin: "google",
      sourceFingerprint: "older source",
    },
  });
}

describe("mergeGeneratedLanguageUpdates", () => {
  it("keeps the generated reading of a line whose syllable readings a shared timing copy rewrote", () => {
    const source = chorusLine("a", 0, 1, "ha neul");
    const target = chorusLine("b", 1, 11, "haneul");
    useProjectStore.getState().reset();
    useProjectStore.setState({ lines: [source, target], groups: [createGroup({ id: "g1", sharesTiming: true })] });
    const startingLines = new Map([[target.id, target]]);
    const request = new AbortController();
    const { edits, stop } = watchGenerationEdits(startingLines, [], request.signal);
    const [word] = source.words ?? [];
    useProjectStore
      .getState()
      .commit(moveWords({ addresses: [addressOf(source, "word", word)], timeDelta: 0.1, duration: 60 }));
    stop();

    const updates = mergeGeneratedLanguageUpdates(
      startingLines,
      useProjectStore.getState().lines,
      [],
      {
        force: true,
        transliteration: {
          language: "ko-Latn",
          main: new Map([["b", { id: "b", text: "ha neul", segments: [] }]]),
          background: new Map(),
        },
        translations: [],
      },
      edits,
    );
    expect(useProjectStore.getState().lines[1].words?.[0].begin).toBe(11.1);
    expect(updates.map((update) => update.updates.languages?.transliteration?.main.text)).toEqual(["ha neul"]);
  });

  it("keeps a line off the request when its readings were re-saved in the alignment editor", () => {
    const line = legacyLine({
      id: "line",
      agentId: "v1",
      text: "하|늘",
      words: [
        {
          id: "w1",
          text: "하",
          sep: "",
          begin: 0,
          end: 0.5,
          transliteration: "ha",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w2", text: "늘", sep: "", begin: 0.5, end: 1, transliteration: "neul", joinsNext: false },
      ],
      transliteration: {
        language: "ko-Latn",
        text: "haneul",
        segments: [],
        alignmentStatus: "confirmed",
        origin: "google",
        sourceFingerprint: languageSourceFingerprint("하|늘", undefined),
      },
    });
    useProjectStore.getState().reset();
    useProjectStore.setState({ lines: [line] });
    const startingLines = new Map([[line.id, line]]);
    const request = new AbortController();
    const { edits, stop } = watchGenerationEdits(startingLines, [], request.signal);
    useProjectStore
      .getState()
      .commit(
        saveTransliterationAlignment("line", "words", { w1: { text: "han", joinerAfter: "" }, w2: { text: "eul" } }),
      );
    stop();

    const updates = mergeGeneratedLanguageUpdates(
      startingLines,
      useProjectStore.getState().lines,
      [],
      {
        force: true,
        transliteration: {
          language: "ko-Latn",
          main: new Map([["line", { id: "line", text: "ha neul", segments: [] }]]),
          background: new Map(),
        },
        translations: [],
      },
      edits,
    );
    expect(updates).toEqual([]);
  });
});
