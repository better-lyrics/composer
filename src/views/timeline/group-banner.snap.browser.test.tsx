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

const chorus = createLine({
  id: "c0",
  text: "go now",
  words: [createWord({ text: "go ", begin: 10, end: 11 }), createWord({ text: "now", begin: 11, end: 12 })],
  groupId: "g1",
  instanceIdx: 0,
  templateLineIdx: 0,
});

async function dragBanner(dxPx: number): Promise<void> {
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
  const startX = 100;
  banner.dispatchEvent(new PointerEvent("pointerdown", { clientX: startX, button: 0, bubbles: true }));
  document.dispatchEvent(new PointerEvent("pointermove", { clientX: startX + dxPx, bubbles: true }));
  document.dispatchEvent(new PointerEvent("pointerup", { clientX: startX + dxPx, bubbles: true }));
}

const firstWordBegin = () => useProjectStore.getState().lines[0].words?.[0].begin;

// -- Tests --------------------------------------------------------------------

describe("GroupBanner · snap", () => {
  it("snaps the instance start to a snap marker near the drop point", async () => {
    useSettingsStore.setState({ timelineSnap: true });

    await dragBanner(2 * ZOOM);

    expect(firstWordBegin()).toBeCloseTo(12.1, 6);
  });
});
