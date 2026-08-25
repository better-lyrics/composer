import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapPoints } from "@/test/factories";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { SnapMarkersOverlay } from "@/views/timeline/snap-markers-overlay";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineFrameWake } from "@/views/timeline/use-timeline-frame-wake";

// -- Interfaces ----------------------------------------------------------------

interface HarnessProps {
  wakeSources?: boolean;
}

// -- Constants -----------------------------------------------------------------

const VIEWPORT_WIDTH = 600;
const VIEWPORT_HEIGHT = 200;
const CONTENT_WIDTH = 3000;
const CONTENT_HEIGHT = 400;

// -- Harness -------------------------------------------------------------------

const Harness: React.FC<HarnessProps> = ({ wakeSources = true }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useTimelineFrameWake(scrollContainerRef, hostRef, wakeSources);
  return (
    <div ref={hostRef} style={{ position: "relative", width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }}>
      <div
        ref={scrollContainerRef}
        data-test="scroll-container"
        style={{ position: "absolute", inset: 0, overflow: "auto" }}
      >
        <div style={{ width: CONTENT_WIDTH, height: CONTENT_HEIGHT }} />
      </div>
      <SnapMarkersOverlay scrollContainerRef={scrollContainerRef} />
    </div>
  );
};

let unsubscribeProbe: (() => void) | null = null;
let frames = 0;

function seedNothingToShow(): void {
  useSettingsStore.setState({ vocalOnsetSnap: false });
  useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [], markerMode: false });
  useProjectStore.setState({ customSnapPoints: [] });
}

function layerOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-snap-markers-layer]");
}

function scrollContainerOf(root: HTMLElement): HTMLDivElement {
  const container = root.querySelector<HTMLDivElement>("[data-test='scroll-container']");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function transformAt(scrollLeft: number): string {
  return `translate3d(${GUTTER_WIDTH - scrollLeft}px, 0px, 0px)`;
}

async function quiesce(): Promise<void> {
  await settleFrames(() => frames);
  frames = 0;
}

beforeEach(() => {
  frames = 0;
  unsubscribeProbe = subscribeFrame(() => {
    frames += 1;
  });
});

afterEach(() => {
  unsubscribeProbe?.();
  unsubscribeProbe = null;
});

// -- Tests ---------------------------------------------------------------------

describe("SnapMarkersOverlay on the frame loop", () => {
  it("keeps the layer transform in sync with horizontal scroll", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2], markerMode: false });

    const screen = await render(<Harness />);
    const container = scrollContainerOf(screen.container);
    await expect.poll(() => layerOf(screen.container)?.style.transform).toBe(transformAt(0));

    container.scrollLeft = 240;
    await expect.poll(() => layerOf(screen.container)?.style.transform).toBe(transformAt(240));
  });

  it("applies the transform once marker mode turns the overlay on", async () => {
    seedNothingToShow();

    const screen = await render(<Harness />);
    expect(layerOf(screen.container)).toBeNull();

    const container = scrollContainerOf(screen.container);
    container.scrollLeft = 120;
    useTimelineStore.setState({ markerMode: true });

    await expect.poll(() => layerOf(screen.container)?.style.transform).toBe(transformAt(120));
  });

  it("stops updating the layer once the overlay is turned off", async () => {
    useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [], markerMode: true });
    useProjectStore.setState({ customSnapPoints: [] });
    useSettingsStore.setState({ vocalOnsetSnap: false });

    const screen = await render(<Harness />);
    await expect.poll(() => layerOf(screen.container)?.style.transform).toBe(transformAt(0));

    useTimelineStore.setState({ markerMode: false });
    await expect.poll(() => layerOf(screen.container)).toBeNull();
  });

  describe("invariants", () => {
    it("regression #174: never subscribes while there is nothing to show", async () => {
      seedNothingToShow();
      await quiesce();

      await render(<Harness wakeSources={false} />);

      await settleFrames(() => frames);
      expect(frames).toBe(0);
    });

    it("regression #174: stops running frames once the overlay settles", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: true });
      useTimelineStore.setState({ zoom: 100, scrollLeft: 0, vocalOnsetSnapPoints: [1, 2], markerMode: true });
      useProjectStore.setState({ customSnapPoints: snapPoints([1]) });

      const screen = await render(<Harness />);
      await expect.poll(() => layerOf(screen.container)?.style.transform).toBe(transformAt(0));
      await quiesce();

      await settleFrames(() => frames);
      expect(frames).toBe(0);
    });
  });
});
