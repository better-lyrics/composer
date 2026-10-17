import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";

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

describe("TimelineContextMenu · banner sharing items", () => {
  it("gives a shared instance its own timing", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 1);
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Use own timing" }).click();

    await expect.poll(() => group().ownTimingInstances).toEqual([1]);
    await expect.element(screen.getByText("Chorus 2 uses its own timing")).toBeVisible();
  });

  it("shares timing again for an own-timing instance and takes the shared timing", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }), 1);
    useProjectStore.setState({ lines: [chorus(0, 10), chorus(1, 40, 1.2)] });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing", exact: true }).click();

    await expect.poll(() => group().ownTimingInstances).toBeUndefined();
    expect(secondWordBegin("c1")).toBeCloseTo(41.5, 6);
    await expect.element(screen.getByText("Chorus 2 shares timing again. Its own timing was replaced.")).toBeVisible();
  });

  it("edge case: says nothing was replaced when the own timing already matched", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }), 1);
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing" }).click();

    await expect.element(screen.getByText("Chorus 2 shares timing again", { exact: true })).toBeVisible();
  });

  it("edge case: says nothing was replaced when sharing only fills untimed lines", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }), 1);
    const line = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
      createLine({
        id: `c${instanceIdx}-${templateLineIdx}`,
        text: templateLineIdx === 0 ? "go now" : "stay here",
        groupId: "g1",
        instanceIdx,
        templateLineIdx,
        ...(begin === undefined ? {} : { begin, end: begin + 1 }),
      });
    useProjectStore.setState({ lines: [line(0, 0, 10), line(0, 1, 13), line(1, 0, 40), line(1, 1)] });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing", exact: true }).click();

    await expect.element(screen.getByText("Chorus 2 shares timing again", { exact: true })).toBeVisible();
    expect(store().lines[3].begin).toBe(43);
  });

  it("keeps own timing and says why when no instance is fully timed", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }), 1);
    useProjectStore.setState({
      lines: [
        createLine({ id: "c0", text: "go now", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
        chorus(1, 40),
      ],
    });
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Share timing" }).click();

    await expect
      .element(
        screen.getByText("Chorus 2 keeps its own timing. Sync one instance fully, then choose Share timing again."),
      )
      .toBeVisible();
    expect(group().ownTimingInstances).toEqual([1]);
  });

  it("undoes an override change from the toast", async () => {
    seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 1);
    const screen = await renderMenu();
    await screen.getByRole("button", { name: "Use own timing" }).click();
    await expect.poll(() => group().ownTimingInstances).toEqual([1]);

    await screen.getByRole("button", { name: "Undo" }).click();

    await expect.poll(() => group().ownTimingInstances).toBeUndefined();
  });

  describe("edge cases", () => {
    it("offers only the item that matches a shared instance", async () => {
      seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 0);
      const screen = await renderMenu();

      await expect.element(screen.getByRole("button", { name: "Use own timing" })).toBeVisible();
      expect(screen.container.ownerDocument.body.textContent).not.toContain("Share timing");
    });

    it("offers only Share timing across group for an old group", async () => {
      seedBannerMenu(createGroup({ id: "g1", label: "Chorus" }), 0);
      const screen = await renderMenu();

      await expect.element(screen.getByRole("button", { name: "Share timing across group" })).toBeVisible();
      expect(screen.container.ownerDocument.body.textContent).not.toContain("Use own timing");
    });
  });

  describe("invariants", () => {
    it("closes the menu and records one undo step", async () => {
      seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 1);
      const screen = await renderMenu();
      await screen.getByRole("button", { name: "Use own timing" }).click();

      await expect.poll(() => useTimelineStore.getState().contextMenu).toBeNull();
      store().undo();
      expect(group().ownTimingInstances).toBeUndefined();
      expect(store().canUndo()).toBe(false);
    });

    it("leaves the timing of an instance unchanged when it takes its own timing", async () => {
      seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 1);
      const before = store().lines;
      const screen = await renderMenu();
      await screen.getByRole("button", { name: "Use own timing" }).click();

      await expect.poll(() => group().ownTimingInstances).toEqual([1]);
      expect(store().lines).toEqual(before);
    });
  });
});

describe("TimelineContextMenu · banner sharing items keep the old items", () => {
  beforeEach(() => seedBannerMenu(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }), 0));

  it("still offers Ping siblings", async () => {
    const screen = await renderMenu();
    await expect.element(screen.getByRole("button", { name: "Ping siblings" })).toBeVisible();
  });
});
