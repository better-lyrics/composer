import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeFrame } from "@/lib/frame-loop";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineFrameWake } from "@/views/timeline/use-timeline-frame-wake";

// -- Constants -----------------------------------------------------------------

const ROW_ID = "content-row";
const VIEWPORT_WIDTH = 600;
const VIEWPORT_HEIGHT = 200;
const CONTENT_WIDTH = 2000;
const ROW_COUNT = 10;
const DEFAULT_ROW_HEIGHT = 80;
const RESIZED_ROW_HEIGHT = 120;
const DEFAULT_CONTENT_HEIGHT = DEFAULT_ROW_HEIGHT * ROW_COUNT;
const WORD_BLOCK_TOP = 200;
const WORD_BLOCK_HEIGHT = 100;
const WORD_BLOCK_WIDTH = 1200;
const LIVE_FRAMES = 12;

// -- Harness -------------------------------------------------------------------

const Harness: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowHeight = useTimelineStore((s) => s.rowHeights[ROW_ID] ?? DEFAULT_ROW_HEIGHT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useTimelineFrameWake(scrollContainerRef, hostRef, true);

  return (
    <div ref={hostRef} style={{ position: "relative", width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }}>
      <div
        ref={scrollContainerRef}
        data-test="scroll-container"
        style={{ position: "absolute", inset: 0, overflow: "auto" }}
      >
        <div style={{ position: "relative", width: CONTENT_WIDTH, height: rowHeight * ROW_COUNT }}>
          <div
            data-word-block
            style={{
              position: "absolute",
              left: 0,
              top: WORD_BLOCK_TOP,
              width: WORD_BLOCK_WIDTH,
              height: WORD_BLOCK_HEIGHT,
            }}
          />
        </div>
      </div>
      {mounted && <TimelinePlayhead containerHeight={VIEWPORT_HEIGHT} scrollContainerRef={scrollContainerRef} />}
    </div>
  );
};

let disposeWiring: (() => void) | null = null;
let unsubscribeProbe: (() => void) | null = null;
let frames = 0;

function seedPaused(zoom: number, currentTime: number): void {
  useAudioStore.setState({ duration: 60, currentTime, isPlaying: false });
  useTimelineStore.setState({ zoom, scrollLeft: 0, isDraggingPlayhead: false, followEnabled: false });
}

function playheadBar(root: HTMLElement): HTMLElement {
  const bar = root.querySelector<HTMLElement>("[role='separator']");
  if (!bar) throw new Error("playhead bar missing");
  return bar;
}

function scrollContainerOf(root: HTMLElement): HTMLDivElement {
  const container = root.querySelector<HTMLDivElement>("[data-test='scroll-container']");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function transformAt(time: number, zoom: number, scrollLeft: number): string {
  return `translate3d(${time * zoom - scrollLeft + GUTTER_WIDTH - 1}px, 0px, 0px)`;
}

async function quiesce(): Promise<void> {
  await settleFrames(() => frames);
  frames = 0;
}

async function wokeAfter(trigger: () => void): Promise<boolean> {
  await quiesce();
  trigger();
  await settleFrames(() => frames);
  return frames > 0;
}

beforeEach(() => {
  frames = 0;
  disposeWiring = wireFrameLoop();
  unsubscribeProbe = subscribeFrame(() => {
    frames += 1;
  });
});

afterEach(() => {
  unsubscribeProbe?.();
  disposeWiring?.();
  unsubscribeProbe = null;
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("TimelinePlayhead on the frame loop", () => {
  it("keeps translating while the audio plays and after it pauses", async () => {
    seedPaused(50, 0);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);

    useAudioStore.getState().setIsPlaying(true);
    useAudioStore.getState().setCurrentTime(2);
    await expect.poll(() => bar.style.transform).toBe(transformAt(2, 50, 0));

    useAudioStore.getState().setIsPlaying(false);
    useAudioStore.getState().setCurrentTime(4);
    await expect.poll(() => bar.style.transform).toBe(transformAt(4, 50, 0));
  });

  it("follows a seek while paused", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 50, 0));

    useAudioStore.getState().seekTo(21);
    await expect.poll(() => bar.style.transform).toBe(transformAt(21, 50, 0));
  });

  it("re-lays out after a zoom change while paused", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 50, 0));

    useTimelineStore.getState().setZoom(120);
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 120, 0));
  });

  it("follows horizontal scroll while paused", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    const container = scrollContainerOf(screen.container);
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 50, 0));

    container.scrollLeft = 120;
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 50, 120));
  });

  it("re-masks after vertical scroll while paused", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    const container = scrollContainerOf(screen.container);
    await expect.poll(() => bar.style.maskImage).toContain(`${WORD_BLOCK_TOP}px`);

    container.scrollTop = 50;
    await expect.poll(() => bar.style.maskImage).toContain(`${WORD_BLOCK_TOP - 50}px`);
  });

  it("grows with the scroll content when a row is resized", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    await expect.poll(() => bar.style.height).toBe(`${DEFAULT_CONTENT_HEIGHT}px`);

    useTimelineStore.getState().setRowHeight(ROW_ID, RESIZED_ROW_HEIGHT);
    await expect.poll(() => bar.style.height).toBe(`${RESIZED_ROW_HEIGHT * ROW_COUNT}px`);
  });

  it("tracks the pointer while the playhead is dragged", async () => {
    seedPaused(50, 5);
    const screen = await render(<Harness />);
    const bar = playheadBar(screen.container);
    const container = scrollContainerOf(screen.container);
    await expect.poll(() => bar.style.transform).toBe(transformAt(5, 50, 0));

    const rect = container.getBoundingClientRect();
    bar.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: rect.left + 298, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: rect.left + GUTTER_WIDTH + 400, bubbles: true }));

    await expect.poll(() => bar.style.transform).toBe(transformAt(8, 50, 0));
    expect(useTimelineStore.getState().dragTime).toBe(8);

    document.dispatchEvent(new MouseEvent("mouseup", { clientX: rect.left + GUTTER_WIDTH + 400, bubbles: true }));
  });

  describe("wake sources", () => {
    it("keeps updating after a line text edit", async () => {
      seedPaused(50, 5);
      await render(<Harness />);

      const woke = await wokeAfter(() => {
        useProjectStore
          .getState()
          .setLines([
            createLine({ id: "edited", text: "new", words: [createWord({ text: "new", begin: 1, end: 2 })] }),
          ]);
      });
      expect(woke).toBe(true);
    });

    it("keeps updating after follow mode is toggled", async () => {
      seedPaused(50, 5);
      await render(<Harness />);

      expect(await wokeAfter(() => useTimelineStore.getState().toggleFollow())).toBe(true);
    });

    it("keeps updating after an instance is collapsed and expanded", async () => {
      seedPaused(50, 5);
      await render(<Harness />);

      expect(await wokeAfter(() => useTimelineStore.getState().setInstanceCollapsed("group-1:0", true))).toBe(true);
      expect(await wokeAfter(() => useTimelineStore.getState().setInstanceCollapsed("group-1:0", false))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("regression #174: stops running frames once the audio is paused and idle", async () => {
      seedPaused(50, 5);
      await render(<Harness />);

      useAudioStore.getState().setIsPlaying(true);
      await stepFrames(LIVE_FRAMES);
      expect(frames).toBeGreaterThan(LIVE_FRAMES - 2);

      useAudioStore.getState().setIsPlaying(false);
      const settled = await settleFrames(() => frames);
      await stepFrames(30);
      expect(frames).toBe(settled);
    });

    it("regression #174: follow mode does not keep the loop awake while paused", async () => {
      seedPaused(50, 5);
      useTimelineStore.setState({ followEnabled: true });
      await render(<Harness />);
      await quiesce();

      await settleFrames(() => frames);
      expect(frames).toBe(0);
    });
  });
});
