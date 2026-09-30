import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";

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
