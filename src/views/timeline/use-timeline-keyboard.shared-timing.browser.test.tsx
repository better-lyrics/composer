import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWord } from "@/test/factories";
import { isMac } from "@/utils/platform";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";
import { createRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

const DURATION = 60;

const chorus = createLine({
  id: "c0",
  text: "go now",
  groupId: "g1",
  instanceIdx: 0,
  templateLineIdx: 0,
  words: [createWord({ text: "go ", begin: 3, end: 4 }), createWord({ text: "now", begin: 4, end: 5 })],
});

const chorusSelection: WordSelection[] = [
  { lineId: "c0", lineIndex: 0, wordIndex: 0, type: "word" },
  { lineId: "c0", lineIndex: 0, wordIndex: 1, type: "word" },
];

async function armTimeline(options: { lines: LyricLine[]; groups: LinkGroup[]; selection: WordSelection[] }) {
  useAudioStore.setState({ currentTime: 6, duration: DURATION });
  useProjectStore.setState({ activeTab: "timeline", lines: options.lines, groups: options.groups });
  useProjectStore.getState().clearHistory();
  useTimelineStore.setState({ rollingEditMode: false, selectedWords: options.selection });
  const scrollContainerRef = createRef<HTMLDivElement | null>();
  await renderHook(() =>
    useTimelineKeyboard(
      scrollContainerRef,
      useProjectStore((state) => state.lines),
      DURATION,
    ),
  );
}

function pressModKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: isMac, ctrlKey: !isMac, bubbles: true }));
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

beforeEach(() => {
  useSettingsStore.setState({ shareTimingInNewGroups: true });
});

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard · shared timing", () => {
  it("shares timing in a group created from the selection", async () => {
    await armTimeline({
      lines: [createLine({ id: "a", text: "go now", words: [createWord({ text: "go now", begin: 1, end: 2 })] })],
      groups: [],
      selection: [{ lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }],
    });

    pressModKey("g");

    await expect.poll(() => store().groups[0]?.sharesTiming).toBe(true);
  });

  it("creates an old group when the setting is off", async () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    await armTimeline({
      lines: [createLine({ id: "a", text: "go now", words: [createWord({ text: "go now", begin: 1, end: 2 })] })],
      groups: [],
      selection: [{ lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }],
    });

    pressModKey("g");

    await expect.poll(() => store().groups.length).toBe(1);
    expect(store().groups[0].sharesTiming).toBeUndefined();
  });

  it("gives a duplicate of an own-timing instance the shared timing", async () => {
    const sharedChorus = createLine({
      id: "c2",
      text: "go now",
      groupId: "g1",
      instanceIdx: 2,
      templateLineIdx: 0,
      words: [createWord({ text: "go ", begin: 40, end: 41 }), createWord({ text: "now", begin: 41.5, end: 42.5 })],
    });
    await armTimeline({
      lines: [chorus, createLine({ id: "e", text: "" }), sharedChorus],
      groups: [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0] })],
      selection: chorusSelection,
    });

    pressModKey("d");

    await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
    expect(lineById("e")?.words?.[1].begin).toBe(7.5);
  });

  describe("regressions", () => {
    it("regression: a duplicate placed in empty rows does not inherit a removed instance's own timing", async () => {
      await armTimeline({
        lines: [chorus, createLine({ id: "e", text: "" })],
        groups: [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })],
        selection: chorusSelection,
      });

      pressModKey("d");

      await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
      expect(store().groups[0].ownTimingInstances).toBeUndefined();
    });

    it("regression: undo removes the duplicate and restores the group in one step", async () => {
      await armTimeline({
        lines: [chorus, createLine({ id: "e", text: "" })],
        groups: [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })],
        selection: chorusSelection,
      });

      pressModKey("d");
      await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
      store().undo();

      expect(lineById("e")?.groupId).toBeUndefined();
      expect(store().groups[0].ownTimingInstances).toEqual([1]);
    });
  });
});
