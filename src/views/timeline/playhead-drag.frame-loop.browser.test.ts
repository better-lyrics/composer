import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { createPlayheadDrag, type PlayheadDragConfig } from "@/views/timeline/playhead-drag";

// -- Constants -----------------------------------------------------------------

const VIEWPORT_WIDTH = 400;
const VIEWPORT_HEIGHT = 300;
const CONTENT_WIDTH = 6000;
const CONTENT_HEIGHT = 100;
const RELEASE_FRAMES = 6;
const IDLE_FRAMES = 30;

// -- Harness -------------------------------------------------------------------

function buildScrollContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.dataset.test = "scroll-container";
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = `${VIEWPORT_WIDTH}px`;
  container.style.height = `${VIEWPORT_HEIGHT}px`;
  container.style.overflow = "auto";

  const content = document.createElement("div");
  content.style.width = `${CONTENT_WIDTH}px`;
  content.style.height = `${CONTENT_HEIGHT}px`;
  container.appendChild(content);

  document.body.appendChild(container);
  return container;
}

function makeConfig(container: HTMLDivElement): PlayheadDragConfig {
  return {
    getContainerRect: () => container.getBoundingClientRect(),
    getScrollContainer: () => container,
    getDuration: () => 60,
    getZoom: () => 50,
    getStoreScrollLeft: () => container.scrollLeft,
    getCurrentTime: () => 1,
    setIsPlaying: () => undefined,
    setDraggingPlayhead: () => undefined,
    setDragTime: () => undefined,
    seekTo: () => undefined,
    snapTime: (time) => time,
  };
}

function rightEdgeX(container: HTMLDivElement): number {
  return container.getBoundingClientRect().right - 5;
}

function pressAt(drag: ReturnType<typeof createPlayheadDrag>, clientX: number): void {
  drag.onMouseDown({ button: 0, clientX, preventDefault: () => undefined } as unknown as React.MouseEvent);
}

function releaseAt(clientX: number): void {
  document.dispatchEvent(new MouseEvent("mouseup", { clientX, bubbles: true }));
}

let container: HTMLDivElement;
let drag: ReturnType<typeof createPlayheadDrag>;
let probe: FrameProbe;

beforeEach(() => {
  container = buildScrollContainer();
  drag = createPlayheadDrag(makeConfig(container));
  probe = createFrameProbe();
});

afterEach(() => {
  drag.dispose();
  probe.dispose();
  container.remove();
});

async function pressAtEdgeAndScroll(): Promise<void> {
  pressAt(drag, rightEdgeX(container));
  await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
}

// -- Tests ---------------------------------------------------------------------

describe("playhead drag edge scroll", () => {
  it("scrolls the container while the pointer sits in the right edge zone", async () => {
    await pressAtEdgeAndScroll();
  });

  it("keeps scrolling while the pointer is held still at the edge", async () => {
    await pressAtEdgeAndScroll();

    const before = container.scrollLeft;
    await stepFrames(IDLE_FRAMES);
    expect(container.scrollLeft).toBeGreaterThan(before);
  });

  it("stops scrolling once the drag is released", async () => {
    await pressAtEdgeAndScroll();

    releaseAt(rightEdgeX(container));
    await stepFrames(RELEASE_FRAMES);
    const parked = container.scrollLeft;

    await stepFrames(IDLE_FRAMES);
    expect(container.scrollLeft).toBe(parked);
  });

  describe("regressions", () => {
    it("regression #174: the hold is released when the drag is disposed mid-drag", async () => {
      await pressAtEdgeAndScroll();

      drag.dispose();
      await stepFrames(RELEASE_FRAMES);
      const parked = container.scrollLeft;

      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
      expect(container.scrollLeft).toBe(parked);
    });

    it("regression #174: the loop quiesces after the drag ends", async () => {
      await pressAtEdgeAndScroll();

      releaseAt(rightEdgeX(container));
      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
    });

    it("regression #174: disposing twice mid-drag quiesces the loop and a later drag still scrolls", async () => {
      await pressAtEdgeAndScroll();

      drag.dispose();
      drag.dispose();
      await settleFrames(probe.count);

      const resumedFrom = container.scrollLeft;
      pressAt(drag, rightEdgeX(container));
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(resumedFrom);

      releaseAt(rightEdgeX(container));
      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
    });

    it("regression #174: restarting a drag before releasing it leaves no stale hold", async () => {
      await pressAtEdgeAndScroll();
      pressAt(drag, rightEdgeX(container));

      const resumedFrom = container.scrollLeft;
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(resumedFrom);

      releaseAt(rightEdgeX(container));
      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
    });
  });
});
