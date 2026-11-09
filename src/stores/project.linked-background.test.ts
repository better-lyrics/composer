/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import { backgroundFields, manualBackgroundWordEdit, withSeededBackground } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

function seedTwoInstancesWithTimings() {
  useProjectStore.getState().addGroup(seedGroup("g1"));
  useProjectStore.setState({
    lines: [
      {
        id: "a0",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        begin: 30,
        end: 32,
      },
      {
        id: "a1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        begin: 60,
        end: 62,
      },
    ],
  });
}

describe("project store · background vocals across linked instances", () => {
  it("regression: a new background vocal gets seeded words in every linked instance", () => {
    seedTwoInstancesWithTimings();
    const source = useProjectStore.getState().lines.find((l) => l.id === "a0");
    if (!source) throw new Error("a0 not found");
    const seededWords = withSeededBackground({ ...source, backgroundText: "ooh yeah" }).backgroundWords;

    useProjectStore
      .getState()
      .updateLineWithHistory("a0", backgroundFields({ text: "ooh yeah", words: seededWords, source: "manual" }));

    const sibling = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(sibling?.backgroundText).toBe("ooh yeah");
    expect(sibling?.backgroundWords?.map((w) => w.text).join("")).toBe("ooh yeah");
    expect(sibling?.backgroundWords?.[0].begin).toBeGreaterThanOrEqual(60);
    expect(sibling?.backgroundWords?.at(-1)?.end).toBeLessThanOrEqual(62);
  });

  it("regression: a background edit reaches an instance with a diverged split, and later splits stay in step", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const instance = (id: string, instanceIdx: number, backgroundWords: LyricLine["backgroundWords"]): LyricLine => ({
      id,
      text: "hold me",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      begin: (backgroundWords?.[0].begin ?? 0) - 1,
      end: backgroundWords?.at(-1)?.end ?? 0,
      backgroundText: backgroundWords?.map((w) => w.text).join(""),
      backgroundWords,
      backgroundTextSource: "manual",
    });
    useProjectStore.setState({
      lines: [
        instance("a0", 0, [
          { text: "ooh ", begin: 10, end: 10.5 },
          { text: "yeah", begin: 10.5, end: 11 },
        ]),
        instance("a1", 1, [
          { text: "oo", begin: 60, end: 60.5 },
          { text: "oh ", begin: 60.5, end: 61 },
          { text: "yeah", begin: 61, end: 61.5 },
        ]),
      ],
    });
    const bgTexts = (id: string) =>
      useProjectStore
        .getState()
        .lines.find((l) => l.id === id)
        ?.backgroundWords?.map((w) => w.text);

    useProjectStore.getState().updateLineWithHistory(
      "a0",
      manualBackgroundWordEdit([
        { text: "ahh ", begin: 10, end: 10.5 },
        { text: "yeah", begin: 10.5, end: 11 },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.backgroundText).toBe("ahh yeah");
    expect(bgTexts("a1")).toEqual(["ahh ", "yeah"]);
    expect(a1?.backgroundWords?.[0].begin).toBe(60);
    expect(a1?.backgroundWords?.at(-1)?.end).toBe(61.5);

    const split = [
      { text: "ahh ", begin: 10, end: 10.5 },
      { text: "ye", begin: 10.5, end: 10.75 },
      { text: "ah", begin: 10.75, end: 11 },
    ];
    useProjectStore
      .getState()
      .applyWordCountChange("a0", split, "backgroundWords", "apply", manualBackgroundWordEdit(split));

    expect(bgTexts("a1")).toEqual(["ahh ", "ye", "ah"]);
  });
});
