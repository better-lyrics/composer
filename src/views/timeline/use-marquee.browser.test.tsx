import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeFrame } from "@/lib/frame-loop";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { useMarquee } from "@/views/timeline/use-marquee";

// -- Constants -----------------------------------------------------------------

const VIEWPORT_WIDTH = 400;
const VIEWPORT_HEIGHT = 300;
const CONTENT_SIZE = 4000;
const RELEASE_FRAMES = 6;
const IDLE_FRAMES = 30;

// -- Harness -------------------------------------------------------------------

const Harness: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { marqueeRect, handleMarqueeMouseDown } = useMarquee(scrollContainerRef);

  return (
    <div
      ref={scrollContainerRef}
      data-test="scroll-container"
      onMouseDown={handleMarqueeMouseDown}
      style={{ position: "relative", width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, overflow: "auto" }}
    >
      <div style={{ width: CONTENT_SIZE, height: CONTENT_SIZE }} />
      {marqueeRect && <div data-test="marquee" style={{ position: "absolute", top: 0, left: 0 }} />}
    </div>
  );
};

// -- Helpers -------------------------------------------------------------------

function scrollContainerOf(root: HTMLElement): HTMLDivElement {
  const container = root.querySelector<HTMLDivElement>("[data-test='scroll-container']");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function pressInside(container: HTMLElement): DOMRect {
  const rect = container.getBoundingClientRect();
  container.dispatchEvent(
    new MouseEvent("mousedown", { button: 0, clientX: rect.left + 60, clientY: rect.top + 60, bubbles: true }),
  );
  return rect;
}

function dragToBottomEdge(rect: DOMRect): void {
  document.dispatchEvent(
    new MouseEvent("mousemove", { clientX: rect.left + 70, clientY: rect.top + VIEWPORT_HEIGHT - 10, bubbles: true }),
  );
}

function releaseDrag(): void {
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function marqueeIn(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-test='marquee']");
}

interface FrameRelease {
  releaseWithinFrame: () => Promise<void>;
  dispose: () => void;
}

function createFrameRelease(): FrameRelease {
  let pendingRelease: (() => void) | null = null;
  const unsubscribe = subscribeFrame(() => {
    const resolveRelease = pendingRelease;
    if (!resolveRelease) return;
    pendingRelease = null;
    try {
      releaseDrag();
    } finally {
      resolveRelease();
    }
  }, "marquee-release-gate");

  return {
    releaseWithinFrame: () =>
      new Promise<void>((resolve) => {
        pendingRelease = resolve;
      }),
    dispose: unsubscribe,
  };
}

async function dragToEdgeAndScroll(root: HTMLElement): Promise<{ container: HTMLDivElement; rect: DOMRect }> {
  const container = scrollContainerOf(root);
  const rect = pressInside(container);
  dragToBottomEdge(rect);
  await expect.poll(() => container.scrollTop).toBeGreaterThan(0);
  return { container, rect };
}

let probe: FrameProbe;
let frameRelease: FrameRelease;

beforeEach(() => {
  probe = createFrameProbe();
  // Subscribed before the hook's autoScroll subscriber so the mouseup lands in the same task, ahead of it.
  frameRelease = createFrameRelease();
});

afterEach(() => {
  releaseDrag();
  frameRelease.dispose();
  probe.dispose();
});

// -- Tests ---------------------------------------------------------------------

describe("useMarquee auto-scroll", () => {
  it("scrolls the container when the pointer reaches the bottom edge zone", async () => {
    const screen = await render(<Harness />);
    await dragToEdgeAndScroll(screen.container);
  });

  it("keeps scrolling while the pointer is held still at the edge", async () => {
    const screen = await render(<Harness />);
    const { container } = await dragToEdgeAndScroll(screen.container);

    const before = container.scrollTop;
    await stepFrames(IDLE_FRAMES);
    expect(container.scrollTop).toBeGreaterThan(before);
  });

  it("stops scrolling once the drag is released", async () => {
    const screen = await render(<Harness />);
    const { container } = await dragToEdgeAndScroll(screen.container);

    releaseDrag();
    await stepFrames(RELEASE_FRAMES);
    const parked = container.scrollTop;

    await stepFrames(IDLE_FRAMES);
    expect(container.scrollTop).toBe(parked);
  });

  describe("regressions", () => {
    it("regression #174: the hold is released on unmount mid-drag", async () => {
      const screen = await render(<Harness />);
      const { container } = await dragToEdgeAndScroll(screen.container);

      screen.unmount();
      await stepFrames(RELEASE_FRAMES);
      const parked = container.scrollTop;

      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
      expect(container.scrollTop).toBe(parked);
    });

    it("regression #174: the loop quiesces after the drag ends", async () => {
      const screen = await render(<Harness />);
      await dragToEdgeAndScroll(screen.container);

      releaseDrag();
      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
    });

    it("regression: a mouseup that lands in the auto-scroll frame does not re-show the marquee", async () => {
      const screen = await render(<Harness />);
      await dragToEdgeAndScroll(screen.container);
      expect(marqueeIn(screen.container)).not.toBeNull();

      await frameRelease.releaseWithinFrame();
      await settleFrames(probe.count);

      expect(marqueeIn(screen.container)).toBeNull();
    });

    it("regression #174: a released drag leaves no stale hold, so a second drag scrolls and quiesces too", async () => {
      const screen = await render(<Harness />);
      const { container } = await dragToEdgeAndScroll(screen.container);

      releaseDrag();
      await settleFrames(probe.count);

      const rect = pressInside(container);
      const resumedFrom = container.scrollTop;
      dragToBottomEdge(rect);
      await expect.poll(() => container.scrollTop).toBeGreaterThan(resumedFrom);

      releaseDrag();
      const settled = await settleFrames(probe.count);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(settled);
    });
  });
});
