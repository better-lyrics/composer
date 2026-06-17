import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { snapPoints } from "@/test/factories";
import { SnapMarkersOverlay } from "@/views/timeline/snap-markers-overlay";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Harness -------------------------------------------------------------------

const Harness: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollContainerRef} style={{ width: 600, height: 200, position: "relative" }}>
      <SnapMarkersOverlay scrollContainerRef={scrollContainerRef} />
    </div>
  );
};

const customMarkers = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='custom']");

const flashes = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker-flash]");

const onsetLines = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='onset']");

const pinAtTime = (container: HTMLElement, time: number): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-snap-marker='custom'][data-snap-marker-time='${time}']`);

const headOf = (marker: HTMLElement): HTMLElement => {
  const head = marker.querySelector<HTMLElement>("[data-snap-marker-head]");
  if (!head) throw new Error("pin head not found");
  return head;
};

// -- Tests ---------------------------------------------------------------------

describe("SnapMarkersOverlay placement animation", () => {
  it("flashes a custom pin that is seeded on top of an onset", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [2],
    });
    useProjectStore.setState({ customSnapPoints: snapPoints([2]) });

    const screen = await render(<Harness />);
    await expect.poll(() => flashes(screen.container)).toHaveLength(1);
  });

  it("does not flash a custom pin placed away from every onset", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [2],
    });
    useProjectStore.setState({ customSnapPoints: snapPoints([5]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(1);
    expect(flashes(screen.container)).toHaveLength(0);
  });

  it("fires a flash when a dragged pin lands on an onset", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [5],
    });
    useProjectStore.setState({ customSnapPoints: snapPoints([2]) });

    const screen = await render(<Harness />);
    await expect.poll(() => flashes(screen.container)).toHaveLength(0);

    const head = headOf(customMarkers(screen.container)[0]);
    const rect = screen.container.firstElementChild?.getBoundingClientRect();
    if (!rect) throw new Error("scroll container rect missing");

    head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    const onOnsetClientX = rect.left + GUTTER_WIDTH + 5 * 100;
    head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: onOnsetClientX, pointerId: 1 }));

    await expect.poll(() => flashes(screen.container)).toHaveLength(1);

    head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  });

  it("keeps a single pin mounted across a drag (stable id reuses the DOM node)", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [],
    });
    useProjectStore.setState({ customSnapPoints: snapPoints([2]) });

    const screen = await render(<Harness />);
    const pinBefore = customMarkers(screen.container)[0];

    const head = headOf(pinBefore);
    const rect = screen.container.firstElementChild?.getBoundingClientRect();
    if (!rect) throw new Error("scroll container rect missing");

    head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    for (const targetTime of [3, 4, 5, 6]) {
      const clientX = rect.left + GUTTER_WIDTH + targetTime * 100;
      head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, pointerId: 1 }));
    }

    await expect.poll(() => useProjectStore.getState().customSnapPoints[0].time).toBeCloseTo(6, 5);
    // The pin's id is stable across every move, so AnimatePresence keeps the same
    // DOM node mounted: count stays 1 and the node identity is preserved.
    expect(customMarkers(screen.container)).toHaveLength(1);
    expect(customMarkers(screen.container)[0]).toBe(pinBefore);

    head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  });

  it("does not flash unrelated pins when the array re-sorts mid-drag", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [9],
    });
    useProjectStore.setState({ customSnapPoints: snapPoints([2, 4]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);
    expect(flashes(screen.container)).toHaveLength(0);

    const head = headOf(customMarkers(screen.container)[0]);
    const rect = screen.container.firstElementChild?.getBoundingClientRect();
    if (!rect) throw new Error("scroll container rect missing");

    head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    // Drag the first pin past the second; the store re-sorts but neither pin
    // is on an onset, so no flash should ever appear.
    const clientX = rect.left + GUTTER_WIDTH + 6 * 100;
    head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, pointerId: 1 }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([4, 6]);
    expect(flashes(screen.container)).toHaveLength(0);

    head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  });
});

describe("SnapMarkersOverlay onset entry stagger", () => {
  it("gives each onset line the entry class and an increasing staggered delay", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2, 3] });
    useProjectStore.setState({ customSnapPoints: [] });

    const screen = await render(<Harness />);
    await expect.poll(() => onsetLines(screen.container)).toHaveLength(3);

    const lines = onsetLines(screen.container);
    for (const line of lines) expect(line.classList.contains("snap-onset-enter")).toBe(true);
    expect(lines[0].style.animationDelay).toBe("0ms");
    expect(lines[1].style.animationDelay).toBe("24ms");
    expect(lines[2].style.animationDelay).toBe("48ms");
  });

  it("caps the stagger delay so a large onset count does not crawl in forever", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const many = Array.from({ length: 120 }, (_, i) => i + 1);
    useTimelineStore.setState({ zoom: 5, scrollLeft: 0, vocalOnsetSnapPoints: many });
    useProjectStore.setState({ customSnapPoints: [] });

    const screen = await render(<Harness />);
    await expect.poll(() => onsetLines(screen.container)).toHaveLength(120);

    const lines = onsetLines(screen.container);
    expect(lines[70].style.animationDelay).toBe("900ms");
    expect(lines[119].style.animationDelay).toBe("900ms");
  });
});

describe("SnapMarkersOverlay AnimatePresence enter/exit", () => {
  it("renders a new pin element when a point is appended after first render", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: snapPoints([1, 3]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);

    useProjectStore.getState().addCustomSnapPoint(5);

    await expect.poll(() => customMarkers(screen.container)).toHaveLength(3);
    await expect.poll(() => pinAtTime(screen.container, 5)).not.toBeNull();
    expect(pinAtTime(screen.container, 5)?.style.left).toBe("500px");
  });

  it("renders a new pin element when a point is inserted in the middle after first render", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: snapPoints([1, 3]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);

    useProjectStore.getState().addCustomSnapPoint(2);

    await expect.poll(() => customMarkers(screen.container)).toHaveLength(3);
    await expect.poll(() => pinAtTime(screen.container, 2)).not.toBeNull();
    expect(pinAtTime(screen.container, 2)?.style.left).toBe("200px");
  });

  it("removes a pin from the DOM after delete while the overlay stays mounted", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: snapPoints([1, 2, 3]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(3);

    const targetId = useProjectStore.getState().customSnapPoints[1].id; // the 2 pin
    useProjectStore.getState().removeCustomSnapPoint(targetId);

    // The deleted pin eventually leaves the DOM; the overlay stays mounted because
    // two pins remain, so AnimatePresence keeps animating the survivors.
    await expect.poll(() => pinAtTime(screen.container, 2)).toBeNull();
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);
    expect(screen.container.querySelector("[data-snap-markers-overlay]")).not.toBeNull();
  });

  it("does not change the pin count on a move (same ids, one time changed)", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: snapPoints([2, 4]) });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);
    const movedId = useProjectStore.getState().customSnapPoints[0].id;

    useProjectStore.getState().moveCustomSnapPoint(movedId, 6);

    await expect.poll(() => useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([4, 6]);
    expect(customMarkers(screen.container)).toHaveLength(2);
  });
});
