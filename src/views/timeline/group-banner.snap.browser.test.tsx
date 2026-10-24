import { describe, expect, it } from "vitest";
import { createSnapPoint } from "@/domain/snap-point/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { GroupBanner } from "@/views/timeline/group-banner";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Fixtures -----------------------------------------------------------------

const ZOOM = 50;
const START_X = 100;

const chorus = createLine({
  id: "c0",
  text: "go now",
  words: [createWord({ text: "go ", begin: 10, end: 11 }), createWord({ text: "now", begin: 11, end: 12 })],
  groupId: "g1",
  instanceIdx: 0,
  templateLineIdx: 0,
});

async function renderBanner(): Promise<Element> {
  const group = createGroup({ id: "g1", label: "Chorus" });
  useTimelineStore.setState({ zoom: ZOOM });
  useProjectStore.setState({ groups: [group], lines: [chorus], customSnapPoints: [createSnapPoint(12.1)] });
  const screen = await render(
    <GroupBanner
      group={group}
      instanceIdx={0}
      ordinal={1}
      totalInstances={1}
      instanceStart={10}
      instanceEnd={12}
      isCollapsed={false}
      zoom={ZOOM}
    />,
  );
  const banner = screen.container.querySelector("[data-instance-key]");
  if (!banner) throw new Error("banner not rendered");
  return banner;
}

function pressAndMove(banner: Element, dxPx: number, modifiers: PointerEventInit = {}): void {
  banner.dispatchEvent(new PointerEvent("pointerdown", { clientX: START_X, button: 0, bubbles: true, ...modifiers }));
  document.dispatchEvent(new PointerEvent("pointermove", { clientX: START_X + dxPx, bubbles: true, ...modifiers }));
}

function release(dxPx: number, modifiers: PointerEventInit = {}): void {
  document.dispatchEvent(new PointerEvent("pointerup", { clientX: START_X + dxPx, bubbles: true, ...modifiers }));
}

async function dragBanner(dxPx: number, modifiers: PointerEventInit = {}): Promise<void> {
  pressAndMove(await renderBanner(), dxPx, modifiers);
  release(dxPx, modifiers);
}

const firstWordBegin = () => useProjectStore.getState().lines[0].words?.[0].begin;

// -- Tests --------------------------------------------------------------------

describe("GroupBanner · snap", () => {
  it("snaps the instance start to a snap marker near the drop point", async () => {
    useSettingsStore.setState({ timelineSnap: true });

    await dragBanner(2 * ZOOM);

    expect(firstWordBegin()).toBeCloseTo(12.1, 6);
  });

  it("regression: skips the snap while the bypass key is held from the start", async () => {
    useSettingsStore.setState({ timelineSnap: true });

    await dragBanner(2 * ZOOM, { metaKey: true, ctrlKey: true });

    expect(firstWordBegin()).toBeCloseTo(12, 6);
  });

  it("regression: snaps again when the bypass key is released mid-drag", async () => {
    useSettingsStore.setState({ timelineSnap: true });
    const banner = await renderBanner();

    pressAndMove(banner, 2 * ZOOM, { metaKey: true, ctrlKey: true });
    await expect.poll(() => banner.className).toContain("cursor-grabbing");
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" }));

    expect(useTimelineStore.getState().isBypassing).toBe(false);
    release(2 * ZOOM);
  });

  it("regression: keeps the bypass when vocal onsets arrive mid-drag", async () => {
    useSettingsStore.setState({ timelineSnap: true });
    const banner = await renderBanner();

    pressAndMove(banner, 2 * ZOOM, { metaKey: true, ctrlKey: true });
    await expect.poll(() => banner.className).toContain("cursor-grabbing");
    useTimelineStore.setState({ vocalOnsetSnapPoints: [30] });

    expect(useTimelineStore.getState().isBypassing).toBe(true);
    release(2 * ZOOM, { metaKey: true, ctrlKey: true });
  });
});
