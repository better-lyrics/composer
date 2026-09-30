import { beforeEach, describe, expect, it } from "vitest";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { type ContextMenuTarget, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Fixtures -----------------------------------------------------------------

const timedChorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1.5, end: begin + 2 }),
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

const untimedChorus = (instanceIdx: number) =>
  createLine({ id: `c${instanceIdx}`, text: "go now", groupId: "g1", instanceIdx, templateLineIdx: 0 });

const SHARING = createGroup({ id: "g1", label: "Chorus", sharesTiming: true });

function seed(
  target: ContextMenuTarget,
  group: LinkGroup = SHARING,
  lines: LyricLine[] = [timedChorus(0, 10), untimedChorus(1)],
) {
  useAudioStore.setState({ currentTime: 30, duration: 60 });
  useProjectStore.setState({ groups: [group], lines });
  useProjectStore.getState().clearHistory();
  useTimelineStore.setState({ contextMenu: { x: 100, y: 100, target }, selectedWords: [] });
}

const gutterOf = (lineId: string, lineIndex: number): ContextMenuTarget => ({ kind: "gutter", lineId, lineIndex });
const trackOf = (lineId: string, lineIndex: number): ContextMenuTarget => ({
  kind: "track",
  lineId,
  lineIndex,
  time: 50,
  type: "word",
});

const store = () => useProjectStore.getState();
const wordBegins = (id: string) =>
  store()
    .lines.find((line) => line.id === id)
    ?.words?.map((word) => word.begin);

async function expectNoPlaceItem() {
  const screen = await render(<TimelineContextMenu />);
  await expect
    .element(
      screen.getByRole("button", { name: "Delete line" }).or(screen.getByRole("button", { name: "Add word here" })),
    )
    .toBeVisible();
  expect(screen.container.ownerDocument.body.textContent).not.toContain("Place at playhead");
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · place at playhead", () => {
  it("places an unplaced shared instance at the playhead from the line menu", async () => {
    seed(gutterOf("c1", 1));
    const screen = await render(<TimelineContextMenu />);
    await screen.getByRole("button", { name: "Place at playhead" }).click();

    await expect.poll(() => wordBegins("c1")).toEqual([30, 31.5]);
  });

  it("places at the playhead, not the clicked time, from the track menu", async () => {
    seed(trackOf("c1", 1));
    const screen = await render(<TimelineContextMenu />);
    await screen.getByRole("button", { name: "Place at playhead" }).click();

    await expect.poll(() => wordBegins("c1")).toEqual([30, 31.5]);
  });

  describe("edge cases", () => {
    it("is not offered for an instance that is already placed", async () => {
      seed(gutterOf("c1", 1), SHARING, [timedChorus(0, 10), timedChorus(1, 40)]);
      await expectNoPlaceItem();
    });

    it("is not offered for an instance with its own timing", async () => {
      seed(gutterOf("c1", 1), createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }));
      await expectNoPlaceItem();
    });

    it("is not offered for an old group", async () => {
      seed(gutterOf("c1", 1), createGroup({ id: "g1", label: "Chorus" }));
      await expectNoPlaceItem();
    });

    it("is not offered while no other shared instance is fully timed", async () => {
      seed(gutterOf("c1", 1), SHARING, [untimedChorus(0), untimedChorus(1)]);
      await expectNoPlaceItem();
    });

    it("is not offered for a line outside a group", async () => {
      seed(gutterOf("solo", 2), SHARING, [
        timedChorus(0, 10),
        untimedChorus(1),
        createLine({ id: "solo", text: "hey" }),
      ]);
      await expectNoPlaceItem();
    });

    it("is not offered for a detached line", async () => {
      seed(gutterOf("c1", 1), SHARING, [timedChorus(0, 10), { ...untimedChorus(1), detached: true }]);
      await expectNoPlaceItem();
    });
  });

  describe("invariants", () => {
    beforeEach(() => seed(gutterOf("c1", 1)));

    it("places in one undo step and leaves the timed instance alone", async () => {
      const screen = await render(<TimelineContextMenu />);
      await screen.getByRole("button", { name: "Place at playhead" }).click();
      await expect.poll(() => wordBegins("c1")).toEqual([30, 31.5]);

      expect(wordBegins("c0")).toEqual([10, 11.5]);
      store().undo();
      expect(wordBegins("c1")).toBeUndefined();
      expect(store().canUndo()).toBe(false);
    });

    it("closes the menu", async () => {
      const screen = await render(<TimelineContextMenu />);
      await screen.getByRole("button", { name: "Place at playhead" }).click();

      await expect.poll(() => useTimelineStore.getState().contextMenu).toBeNull();
    });
  });
});
