import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
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

const newPins = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker-new]");

const onsetLines = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='onset']");

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
    useProjectStore.setState({ customSnapPoints: [2] });

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
    useProjectStore.setState({ customSnapPoints: [5] });

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
    useProjectStore.setState({ customSnapPoints: [2] });

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

  it("keeps a single pin mounted across a drag (no remount/replay)", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({
      zoom: 100,
      scrollLeft: 0,
      vocalOnsetSnapPoints: [],
    });
    useProjectStore.setState({ customSnapPoints: [2] });

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

    await expect.poll(() => useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(6, 5);
    // Positional key keeps the same DOM node mounted: count stays 1 and the
    // node identity is preserved across every pointermove.
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
    useProjectStore.setState({ customSnapPoints: [2, 4] });

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

    await expect.poll(() => useProjectStore.getState().customSnapPoints).toEqual([4, 6]);
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
    expect(lines[1].style.animationDelay).toBe("10ms");
    expect(lines[2].style.animationDelay).toBe("20ms");
  });

  it("caps the stagger delay so a large onset count does not crawl in forever", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const many = Array.from({ length: 120 }, (_, i) => i + 1);
    useTimelineStore.setState({ zoom: 5, scrollLeft: 0, vocalOnsetSnapPoints: many });
    useProjectStore.setState({ customSnapPoints: [] });

    const screen = await render(<Harness />);
    await expect.poll(() => onsetLines(screen.container)).toHaveLength(120);

    const lines = onsetLines(screen.container);
    expect(lines[70].style.animationDelay).toBe("700ms");
    expect(lines[119].style.animationDelay).toBe("700ms");
  });
});

describe("SnapMarkersOverlay drop-in freshness", () => {
  it("does not flag any pin as new on first render of pre-existing points", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [1, 4, 7] });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(3);
    expect(newPins(screen.container)).toHaveLength(0);
  });

  it("drops in the appended pin", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [1, 3] });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);

    useProjectStore.setState({ customSnapPoints: [1, 3, 5] });

    await expect.poll(() => newPins(screen.container)).toHaveLength(1);
    expect(newPins(screen.container)[0].getAttribute("data-snap-marker-time")).toBe("5");
    expect(newPins(screen.container)[0].style.left).toBe("500px");
  });

  it("drops in the value-2 pin (not value-3) on a middle insert", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [1, 3] });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);

    useProjectStore.setState({ customSnapPoints: [1, 2, 3] });

    await expect.poll(() => newPins(screen.container)).toHaveLength(1);
    // The genuinely-new value-2 pin (left = 2 * zoom) animates in, NOT the
    // shifted value-3 pin that React reuses at the last positional key.
    expect(newPins(screen.container)[0].getAttribute("data-snap-marker-time")).toBe("2");
    expect(newPins(screen.container)[0].style.left).toBe("200px");
  });

  it("does not flag any pin on a move (same count, one value changed)", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [2, 4] });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);

    useProjectStore.setState({ customSnapPoints: [4, 6] });

    await expect.poll(() => useProjectStore.getState().customSnapPoints).toEqual([4, 6]);
    expect(newPins(screen.container)).toHaveLength(0);
  });

  it("does not flag any pin on a delete", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [1, 2, 3] });

    const screen = await render(<Harness />);
    await expect.poll(() => customMarkers(screen.container)).toHaveLength(3);

    useProjectStore.setState({ customSnapPoints: [1, 3] });

    await expect.poll(() => customMarkers(screen.container)).toHaveLength(2);
    expect(newPins(screen.container)).toHaveLength(0);
  });

  it("does not flag a dragged pin as new across pointermoves", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [2] });

    const screen = await render(<Harness />);
    const head = headOf(customMarkers(screen.container)[0]);
    const rect = screen.container.firstElementChild?.getBoundingClientRect();
    if (!rect) throw new Error("scroll container rect missing");

    head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
    for (const targetTime of [3, 4, 5]) {
      const clientX = rect.left + GUTTER_WIDTH + targetTime * 100;
      head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, pointerId: 1 }));
    }

    await expect.poll(() => useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(5, 5);
    expect(newPins(screen.container)).toHaveLength(0);

    head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  });
});
