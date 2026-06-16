import { useRef } from "react";
import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { MARKER_HEAD_CLEARANCE, SnapMarkersOverlay } from "@/views/timeline/snap-markers-overlay";
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

const onsetMarkers = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='onset']");

const customMarkers = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='custom']");

const coveredOnsets = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='onset'][data-covered]");

const headOf = (marker: HTMLElement): HTMLElement => {
  const head = marker.querySelector<HTMLElement>("[data-snap-marker-head]");
  if (!head) throw new Error("pin head not found");
  return head;
};

// -- Tests ---------------------------------------------------------------------

describe("SnapMarkersOverlay", () => {
  it("renders one onset marker per snap point at left = time * zoom", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2] });

    const screen = await render(<Harness />);
    const markers = onsetMarkers(screen.container);

    expect(markers).toHaveLength(2);
    expect(markers[0].style.left).toBe("100px");
    expect(markers[1].style.left).toBe("200px");
  });

  it("styles each onset marker with the dashed onset-line utility", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1] });

    const screen = await render(<Harness />);
    const [marker] = onsetMarkers(screen.container);

    expect(marker.classList.contains("snap-onset-line")).toBe(true);
  });

  it("clips the overlay root to the right of the gutter", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1] });

    const screen = await render(<Harness />);
    const root = screen.container.querySelector<HTMLElement>("[data-snap-markers-overlay]");

    expect(root).not.toBeNull();
    expect(root?.style.clipPath).toBe(`inset(0px 0px 0px ${GUTTER_WIDTH}px)`);
  });

  it("translates the inner layer by GUTTER_WIDTH and head clearance when scrollLeft is 0", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1] });

    const screen = await render(<Harness />);
    const layer = screen.container.querySelector<HTMLElement>("[data-snap-markers-layer]");

    await expect
      .poll(() => layer?.style.transform)
      .toBe(`translate3d(${GUTTER_WIDTH}px, ${MARKER_HEAD_CLEARANCE}px, 0px)`);
  });

  describe("visibility", () => {
    it("renders no onset markers when vocalOnsetSnap is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2] });

      const screen = await render(<Harness />);
      expect(onsetMarkers(screen.container)).toHaveLength(0);
    });

    it("renders null when there is nothing to show and marker mode is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [1, 2],
        customSnapPoints: [],
        markerMode: false,
      });

      const screen = await render(<Harness />);
      expect(screen.container.querySelector("[data-snap-markers-overlay]")).toBeNull();
    });

    it("renders null when onsets are enabled but there are no points and marker mode is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [],
        markerMode: false,
      });

      const screen = await render(<Harness />);
      expect(screen.container.querySelector("[data-snap-markers-overlay]")).toBeNull();
    });

    it("stays mounted when marker mode is on even with nothing to show", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [],
        markerMode: true,
      });

      const screen = await render(<Harness />);
      expect(screen.container.querySelector("[data-snap-markers-overlay]")).not.toBeNull();
    });

    it("stays mounted when custom points exist and marker mode is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [2],
        markerMode: false,
      });

      const screen = await render(<Harness />);
      expect(screen.container.querySelector("[data-snap-markers-overlay]")).not.toBeNull();
    });

    it("stays mounted when onsets are visible and marker mode is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [1],
        customSnapPoints: [],
        markerMode: false,
      });

      const screen = await render(<Harness />);
      expect(screen.container.querySelector("[data-snap-markers-overlay]")).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("renders no onset markers when there are no snap points", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [] });

      const screen = await render(<Harness />);
      expect(onsetMarkers(screen.container)).toHaveLength(0);
    });

    it("places a marker at the timeline origin", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [0] });

      const screen = await render(<Harness />);
      const [marker] = onsetMarkers(screen.container);
      expect(marker.style.left).toBe("0px");
    });
  });

  describe("reactivity", () => {
    it("re-lays out markers when zoom changes", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2] });

      const screen = await render(<Harness />);
      await expect.poll(() => onsetMarkers(screen.container)[0]?.style.left).toBe("100px");

      useTimelineStore.setState({ zoom: 50 });

      await expect.poll(() => onsetMarkers(screen.container)[0]?.style.left).toBe("50px");
      await expect.poll(() => onsetMarkers(screen.container)[1]?.style.left).toBe("100px");
    });

    it("shows markers when the setting is toggled on", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1] });

      const screen = await render(<Harness />);
      await expect.poll(() => onsetMarkers(screen.container)).toHaveLength(0);

      useSettingsStore.getState().set("vocalOnsetSnap", true);

      await expect.poll(() => onsetMarkers(screen.container)).toHaveLength(1);
    });
  });

  describe("custom pins", () => {
    it("renders one pin per custom snap point with a draggable head", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [1, 3],
      });

      const screen = await render(<Harness />);
      const pins = customMarkers(screen.container);
      expect(pins).toHaveLength(2);
      expect(pins[0].style.left).toBe("100px");
      expect(pins[1].style.left).toBe("300px");
      expect(pins[0].querySelector("[data-snap-marker-head]")).not.toBeNull();
    });

    it("renders pins above the onset layer", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [5],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      const onsetLayer = screen.container.querySelector<HTMLElement>("[data-snap-marker='onset']")?.parentElement;
      const customLayer = customMarkers(screen.container)[0]?.parentElement;
      expect(onsetLayer?.classList.contains("z-10")).toBe(true);
      expect(customLayer?.classList.contains("z-20")).toBe(true);
    });
  });

  describe("covered onsets", () => {
    it("covers a coincident onset so its line is suppressed", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [2],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(1);
      const onset = onsetMarkers(screen.container)[0];
      expect(onset.classList.contains("snap-onset-covered")).toBe(true);
    });

    it("leaves an onset visible when no custom point is within threshold", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [2],
        customSnapPoints: [5],
      });

      const screen = await render(<Harness />);
      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(0);
    });

    it("reveals the onset again when the custom point moves away", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [2],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(1);

      useTimelineStore.getState().moveCustomSnapPoint(0, 8);

      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(0);
    });

    it("covers only the onset within threshold among several", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [1, 2, 3],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(1);
      const onsets = onsetMarkers(screen.container);
      expect(onsets[1].classList.contains("snap-onset-covered")).toBe(true);
      expect(onsets[0].classList.contains("snap-onset-covered")).toBe(false);
      expect(onsets[2].classList.contains("snap-onset-covered")).toBe(false);
    });
  });

  describe("drag", () => {
    it("updates moveCustomSnapPoint as the head is dragged", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      const head = headOf(customMarkers(screen.container)[0]);
      const rect = screen.container.firstElementChild?.getBoundingClientRect();
      if (!rect) throw new Error("scroll container rect missing");

      head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
      const targetClientX = rect.left + GUTTER_WIDTH + 5 * 100;
      head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: targetClientX, pointerId: 1 }));

      await expect.poll(() => useTimelineStore.getState().customSnapPoints[0]).toBeCloseTo(5, 5);

      head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });

    it("snaps the dragged head onto an onset within threshold", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [5],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      const head = headOf(customMarkers(screen.container)[0]);
      const rect = screen.container.firstElementChild?.getBoundingClientRect();
      if (!rect) throw new Error("scroll container rect missing");

      head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
      const nearOnsetClientX = rect.left + GUTTER_WIDTH + 5.08 * 100;
      head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: nearOnsetClientX, pointerId: 1 }));

      await expect.poll(() => useTimelineStore.getState().customSnapPoints[0]).toBe(5);

      head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });

    it("does not snap onto an onset outside threshold", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [5],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      const head = headOf(customMarkers(screen.container)[0]);
      const rect = screen.container.firstElementChild?.getBoundingClientRect();
      if (!rect) throw new Error("scroll container rect missing");

      head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
      const farFromOnsetClientX = rect.left + GUTTER_WIDTH + 5.3 * 100;
      head.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX: farFromOnsetClientX, pointerId: 1 }),
      );

      await expect.poll(() => useTimelineStore.getState().customSnapPoints[0]).toBeCloseTo(5.3, 5);

      head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });

    it("covers an onset live while a pin is dragged over it", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [5],
        customSnapPoints: [2],
      });

      const screen = await render(<Harness />);
      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(0);

      const head = headOf(customMarkers(screen.container)[0]);
      const rect = screen.container.firstElementChild?.getBoundingClientRect();
      if (!rect) throw new Error("scroll container rect missing");

      head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1 }));
      const onOnsetClientX = rect.left + GUTTER_WIDTH + 5 * 100;
      head.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: onOnsetClientX, pointerId: 1 }));

      await expect.poll(() => coveredOnsets(screen.container)).toHaveLength(1);

      head.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
  });

  describe("delete", () => {
    it("removes the correct pin when several exist", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({
        zoom: 100,
        scrollLeft: 0,
        vocalOnsetSnapPoints: [],
        customSnapPoints: [1, 2, 3],
      });

      const screen = await render(<Harness />);
      const secondPin = customMarkers(screen.container)[1];
      await userEvent.hover(headOf(secondPin));

      const deleteButton = await vi.waitFor(() => {
        const button = secondPin.querySelector<HTMLButtonElement>("[data-snap-marker-delete]");
        if (!button) throw new Error("delete button not yet rendered");
        return button;
      });
      await userEvent.click(deleteButton);

      await expect.poll(() => useTimelineStore.getState().customSnapPoints).toEqual([1, 3]);
    });
  });
});
