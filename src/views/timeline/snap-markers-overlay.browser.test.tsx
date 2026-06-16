import { useRef } from "react";
import { describe, expect, it } from "vitest";
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

const onsetMarkers = (container: HTMLElement): NodeListOf<HTMLElement> =>
  container.querySelectorAll<HTMLElement>("[data-snap-marker='onset']");

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

  it("translates the inner layer by GUTTER_WIDTH when scrollLeft is 0", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1] });

    const screen = await render(<Harness />);
    const layer = screen.container.querySelector<HTMLElement>("[data-snap-markers-layer]");

    await expect.poll(() => layer?.style.transform).toBe(`translate3d(${GUTTER_WIDTH}px, 0px, 0px)`);
  });

  describe("visibility", () => {
    it("renders no onset markers when vocalOnsetSnap is off", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2] });

      const screen = await render(<Harness />);
      expect(onsetMarkers(screen.container)).toHaveLength(0);
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
});
