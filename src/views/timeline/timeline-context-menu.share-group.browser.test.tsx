import type { LinkGroup } from "@/domain/group/template";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number, secondWordOffset = 1.5) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + secondWordOffset, end: begin + 2 }),
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

function seedBannerMenu(group: LinkGroup, instanceIdx: number) {
  useProjectStore.setState({ groups: [group], lines: [chorus(0, 10), chorus(1, 40)] });
  useProjectStore.getState().clearHistory();
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "group-banner", groupId: "g1", instanceIdx, source: "banner" } },
  });
}

const store = () => useProjectStore.getState();
const group = () => store().groups[0];
const secondWordBegin = (id: string) => store().lines.find((line) => line.id === id)?.words?.[1].begin;

async function renderMenu() {
  return render(
    <>
      <Toaster />
      <TimelineContextMenu />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · Share timing across group", () => {
  it("shares timing across an old group", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect.poll(() => group().sharesTiming).toBe(true);
    await expect.element(screen.getByText("Chorus shares timing in 2 instances")).toBeVisible();
  });

  it("shares timing across an old group and realigns an instance with different timing", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    useProjectStore.setState({ lines: [chorus(0, 10), chorus(1, 40, 1.2)] });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect.poll(() => group().sharesTiming).toBe(true);
    expect(group().ownTimingInstances).toBeUndefined();
    expect(secondWordBegin("c1")).toBeCloseTo(41.5, 6);
    await expect.element(screen.getByText("Chorus shares timing in 2 instances")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Share anyway" })).not.toBeInTheDocument();
  });

  it("keeps the word timing of an instance when the synced instance lacks it, and says why", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    const partlyWordSynced = createLine({
      id: "c1",
      text: "go now",
      words: [createWord({ text: "go ", begin: 40, end: 41 })],
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
    });
    useProjectStore.setState({
      lines: [
        createLine({ id: "c0", text: "go now", begin: 10, end: 12, groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
        partlyWordSynced,
      ],
    });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect
      .element(
        screen.getByText(
          "1 instance kept its own timing: the synced instance is missing word timing this instance has, so sharing would remove it",
        ),
      )
      .toBeVisible();
    expect(group().ownTimingInstances).toEqual([1]);
    expect(store().lines[1]).toEqual(partlyWordSynced);
  });

  it("reports replaced timing with Undo when another instance keeps its own timing", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    useAudioStore.setState({ duration: 120 });
    useProjectStore.setState({ lines: [chorus(0, 10), chorus(1, 40, 1.2), chorus(2, 119, 1.2)] });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect
      .element(screen.getByText("Chorus shares timing in 2 instances. The own timing of 1 instance was replaced."))
      .toBeVisible();
    await expect
      .element(screen.getByText("1 instance kept its own timing: the shared timing would run past the end of the song"))
      .toBeVisible();
    expect(group().ownTimingInstances).toEqual([2]);

    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => group().sharesTiming).toBeUndefined();
    expect(secondWordBegin("c1")).toBe(41.2);
  });

  it("says to share the group again once one instance is fully synced, and offers Undo", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    const firstWordOnly = (instanceIdx: number, begin: number, end: number) =>
      createLine({
        id: `c${instanceIdx}`,
        text: "go now",
        words: [createWord({ text: "go ", begin, end })],
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 0,
      });
    useProjectStore.setState({ lines: [firstWordOnly(0, 10, 10.5), firstWordOnly(1, 40, 40.8)] });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect
      .element(
        screen.getByText(
          "1 instance kept its own timing. Sync one instance fully, then choose Share timing across group again.",
        ),
      )
      .toBeVisible();
    expect(screen.container.ownerDocument.body.textContent).not.toContain("banner menu");
    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => group().sharesTiming).toBeUndefined();
  });

  it("says how to see why when instances keep their own timing for different reasons", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
    useAudioStore.setState({ duration: 120 });
    const partlyWordSynced = createLine({
      id: "c2",
      text: "go now",
      words: [createWord({ text: "go ", begin: 70, end: 71 })],
      groupId: "g1",
      instanceIdx: 2,
      templateLineIdx: 0,
    });
    useProjectStore.setState({
      lines: [
        createLine({ id: "c0", text: "go now", begin: 10, end: 12, groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
        createLine({
          id: "c1",
          text: "go now",
          begin: 119,
          end: 119.5,
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
        }),
        partlyWordSynced,
      ],
    });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing across group" }).click();

    await expect
      .element(
        screen.getByText("2 instances kept their own timing. Choose Share timing on each of their banners to see why."),
      )
      .toBeVisible();
  });
});
