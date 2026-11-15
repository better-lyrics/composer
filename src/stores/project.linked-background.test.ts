import { beforeEach, describe, expect, it } from "vitest";
import { addGroup } from "@/domain/commands/group-edits";
import { pasteLines } from "@/domain/commands/instance-rows";
import { applyWordCountChange } from "@/domain/commands/word-edits";
import type { LinkGroup } from "@/domain/group/template";
import { withBackground, withSeededBackground } from "@/domain/line/background";
import { manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
/**
 * @vitest-environment node
 */
import { backgroundTrack, roleWords, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { withFields } from "@/test/field-updates";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

function seedTwoInstancesWithTimings() {
  useProjectStore.getState().commit(addGroup(seedGroup("g1")));
  useProjectStore.setState({
    lines: [
      lineFromFields({
        id: "a0",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        begin: 30,
        end: 32,
      }),
      lineFromFields({
        id: "a1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        begin: 60,
        end: 62,
      }),
    ],
  });
}

function lineById(id: string): LyricLine {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === id);
  if (!line) throw new Error(`${id} not found`);
  return line;
}

describe("project store · background vocals across linked instances", () => {
  it("regression: a new background vocal gets seeded words in every linked instance", () => {
    seedTwoInstancesWithTimings();
    const source = useProjectStore.getState().lines.find((l) => l.id === "a0");
    if (!source) throw new Error("a0 not found");
    const seededWords = roleWords(withSeededBackground(withFields(source, { backgroundText: "ooh yeah" })), "bg");

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            tracks: withBackground(source, { text: "ooh yeah", words: seededWords, source: "manual" }).tracks,
          },
        },
      ]),
    );

    const sibling = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(backgroundText(sibling!)).toBe("ooh yeah");
    expect(
      timedSyllables(backgroundTrack(sibling!))
        .map((w) => w.text + w.sep)
        .join(""),
    ).toBe("ooh yeah");
    expect(timedSyllables(backgroundTrack(sibling!))[0].begin).toBeGreaterThanOrEqual(60);
    expect(timedSyllables(backgroundTrack(sibling!)).at(-1)?.end).toBeLessThanOrEqual(62);
  });

  it("regression: a background edit reaches an instance with a diverged split, and later splits stay in step", () => {
    useProjectStore.getState().commit(addGroup(seedGroup("g1")));
    const instance = (id: string, instanceIdx: number, backgroundWords: WordTiming[] | undefined): LyricLine =>
      lineFromFields({
        id,
        text: "hold me",
        agentId: "v1",
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 0,
        begin: (backgroundWords?.[0].begin ?? 0) - 1,
        end: backgroundWords?.at(-1)?.end ?? 0,
        backgroundText: backgroundWords?.map((w) => w.text + w.sep).join(""),
        backgroundWords,
        backgroundTextSource: "manual",
      });
    useProjectStore.setState({
      lines: [
        instance("a0", 0, [
          { id: "w1", text: "ooh", sep: " ", begin: 10, end: 10.5, joinsNext: false },
          { id: "w2", text: "yeah", sep: "", begin: 10.5, end: 11, joinsNext: false },
        ]),
        instance("a1", 1, [
          { id: "w3", text: "oo", sep: "", begin: 60, end: 60.5, joinsNext: true },
          { id: "w4", text: "oh", sep: " ", begin: 60.5, end: 61, joinsNext: false },
          { id: "w5", text: "yeah", sep: "", begin: 61, end: 61.5, joinsNext: false },
        ]),
      ],
    });
    const bgTexts = (id: string) =>
      roleWords(
        useProjectStore.getState().lines.find((l) => l.id === id),
        "bg",
      )?.map((w) => w.text + w.sep);

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: manualBackgroundWordEdit(lineById("a0"), [
            { id: "w6", text: "ahh", sep: " ", begin: 10, end: 10.5, joinsNext: false },
            { id: "w7", text: "yeah", sep: "", begin: 10.5, end: 11, joinsNext: false },
          ]),
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(backgroundText(a1!)).toBe("ahh yeah");
    expect(bgTexts("a1")).toEqual(["ahh ", "yeah"]);
    expect(timedSyllables(backgroundTrack(a1!))[0].begin).toBe(60);
    expect(timedSyllables(backgroundTrack(a1!)).at(-1)?.end).toBe(61.5);

    const split = [
      { id: "w8", text: "ahh", sep: " ", begin: 10, end: 10.5, joinsNext: false },
      { id: "w9", text: "ye", sep: "", begin: 10.5, end: 10.75, joinsNext: true },
      { id: "w10", text: "ah", sep: "", begin: 10.75, end: 11, joinsNext: false },
    ];
    useProjectStore.getState().commit(applyWordCountChange("a0", split, "backgroundWords", "apply"));

    expect(bgTexts("a1")).toEqual(["ahh ", "ye", "ah"]);
  });
});
