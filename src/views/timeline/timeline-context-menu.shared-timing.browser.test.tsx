import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function seedProject() {
  useAudioStore.setState({ currentTime: 6, duration: 60 });
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] })],
    lines: [
      createLine({
        id: "c0",
        text: "go now",
        words: [createWord({ text: "go ", begin: 3, end: 4 }), createWord({ text: "now", begin: 4, end: 5 })],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      }),
      createLine({ id: "e", text: "" }),
    ],
  });
  useProjectStore.getState().clearHistory();
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "group-banner", groupId: "g1", instanceIdx: 0, source: "banner" } },
  });
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

async function addInstanceAtPlayhead() {
  const screen = await render(<TimelineContextMenu />);
  await screen.getByRole("button", { name: "Add instance at playhead" }).click();
  await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · add instance to a group that shares timing", () => {
  beforeEach(seedProject);

  it("places the instance in the empty row with the shared timing", async () => {
    await addInstanceAtPlayhead();

    expect(lineById("e")?.words?.[1].begin).toBe(7);
  });

  describe("regressions", () => {
    it("regression: the new instance does not inherit a removed instance's own timing", async () => {
      await addInstanceAtPlayhead();

      expect(store().groups[0].ownTimingInstances).toBeUndefined();
    });

    it("regression: undo restores the row and the group in one step", async () => {
      await addInstanceAtPlayhead();

      store().undo();

      expect(lineById("e")?.groupId).toBeUndefined();
      expect(store().groups[0].ownTimingInstances).toEqual([1]);
    });
  });
});

describe("TimelineContextMenu · add instance from an own-timing banner", () => {
  beforeEach(() => {
    seedProject();
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [0] })],
      lines: [
        ...store().lines,
        createLine({
          id: "c2",
          text: "go now",
          words: [createWord({ text: "go ", begin: 40, end: 41 }), createWord({ text: "now", begin: 41.5, end: 42.5 })],
          groupId: "g1",
          instanceIdx: 2,
          templateLineIdx: 0,
        }),
      ],
    });
    useProjectStore.getState().clearHistory();
  });

  it("gives the new instance the shared timing, not the clicked banner's", async () => {
    await addInstanceAtPlayhead();

    expect(lineById("e")?.words?.[1].begin).toBe(7.5);
  });
});

describe("TimelineContextMenu · group this line", () => {
  beforeEach(() => {
    useProjectStore.setState({ groups: [], lines: [createLine({ id: "a", text: "go now" })] });
    useTimelineStore.setState({
      contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId: "a", lineIndex: 0 } },
      selectedWords: [],
    });
  });

  it("shares timing in the new group when the setting is on", async () => {
    useSettingsStore.setState({ shareTimingInNewGroups: true });
    const screen = await render(<TimelineContextMenu />);
    await screen.getByRole("button", { name: "Group this line" }).click();

    await expect.poll(() => store().groups[0]?.sharesTiming).toBe(true);
  });

  it("creates an old group when the setting is off", async () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    const screen = await render(<TimelineContextMenu />);
    await screen.getByRole("button", { name: "Group this line" }).click();

    await expect.poll(() => store().groups.length).toBe(1);
    expect(store().groups[0].sharesTiming).toBeUndefined();
  });
});

describe("TimelineContextMenu · open group", () => {
  beforeEach(seedProject);

  it("opens the group on the banner's instance and closes the menu", async () => {
    const screen = await render(<TimelineContextMenu />);

    await screen.getByRole("button", { name: /^Open group/ }).click();

    expect(useTimelineStore.getState().focusedGroup).toEqual({ groupId: "g1", hearInstanceIdx: 0 });
    expect(useTimelineStore.getState().contextMenu).toBeNull();
  });

  it("shows the open group shortcut", async () => {
    const screen = await render(<TimelineContextMenu />);

    await expect.element(screen.getByRole("button", { name: /^Open group/ })).toHaveTextContent("↵");
  });
});

describe("TimelineContextMenu · add word here in a group that shares timing", () => {
  const chorus = (id: string, instanceIdx: number, begin: number) =>
    createLine({
      id,
      text: "go now",
      words: [
        createWord({ text: "go ", begin, end: begin + 1 }),
        createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
      ],
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
    });

  function seedChorus(sharesTiming: boolean, backgroundText?: string) {
    useAudioStore.setState({ duration: 20 });
    useSettingsStore.setState({ defaultWordDuration: 1, minWordDuration: 0.05 });
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", label: "Chorus", ...(sharesTiming ? { sharesTiming: true } : {}) })],
      lines: [{ ...chorus("c0", 0, 3), ...(backgroundText ? { backgroundText } : {}) }, chorus("c1", 1, 10)],
    });
    useProjectStore.getState().clearHistory();
  }

  async function addWordHere(type: "word" | "bg", time: number) {
    useTimelineStore.setState({
      contextMenu: { x: 100, y: 100, target: { kind: "track", lineId: "c0", lineIndex: 0, time, type } },
    });
    const screen = await render(<TimelineContextMenu />);
    await screen.getByRole("button", { name: "Add word here" }).click();
  }

  it("keeps the new word inside the range where the latest instance reaches the song end", async () => {
    seedChorus(true);

    await addWordHere("word", 12.9);

    await expect.poll(() => lineById("c0")?.words?.length).toBe(3);
    expect(lineById("c0")?.words?.[2]).toMatchObject({ begin: 12, end: 13 });
    expect(lineById("c1")?.words?.[2]).toMatchObject({ begin: 19, end: 20 });
  });

  it("ends timed background text where the latest instance reaches the song end", async () => {
    seedChorus(true, "oh yeah no");
    useSettingsStore.setState({ defaultWordDuration: 0.2 });

    await addWordHere("bg", 12.9);

    await expect.poll(() => lineById("c0")?.backgroundWords?.length).toBe(3);
    expect(lineById("c0")?.backgroundWords?.at(-1)?.end).toBeLessThanOrEqual(13);
    expect(lineById("c1")?.backgroundWords?.at(-1)?.end).toBeLessThanOrEqual(20);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still places the word up to the song end", async () => {
      seedChorus(false);

      await addWordHere("word", 12.9);

      await expect.poll(() => lineById("c0")?.words?.length).toBe(3);
      expect(lineById("c0")?.words?.[2].begin).toBeCloseTo(12.4, 5);
      expect(lineById("c0")?.words?.[2].end).toBeCloseTo(13.4, 5);
    });
  });
});
