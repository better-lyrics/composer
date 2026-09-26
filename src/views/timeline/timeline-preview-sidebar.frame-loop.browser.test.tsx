import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";

// -- Constants -----------------------------------------------------------------

const LINE_COUNT = 15;
const WORD_SECONDS = 2;
const VIEWPORT_HEIGHT = 200;

// -- Harness -------------------------------------------------------------------

// Tailwind never reaches the test document, so the scroll box the sidebar's own
// classes would create has to come from the harness for scrollIntoView to have a
// scrollable ancestor to move.
const Harness: React.FC = () => (
  <div data-test="viewport" style={{ height: VIEWPORT_HEIGHT, overflow: "auto" }}>
    <TimelinePreviewSidebar />
  </div>
);

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;

function seedLines(): void {
  useProjectStore.setState({
    granularity: "word",
    lines: Array.from({ length: LINE_COUNT }, (_, index) =>
      createLine({
        id: `line-${index}`,
        text: `line ${index}`,
        words: [{ text: `line ${index}`, begin: index * WORD_SECONDS, end: (index + 1) * WORD_SECONDS }],
      }),
    ),
  });
}

function attachAudio(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

function wordSweep(root: HTMLElement, lineIndex: number): string | undefined {
  return root.querySelector<HTMLElement>(`[data-word-begin='${lineIndex * WORD_SECONDS}']`)?.style.clipPath;
}

function sweptTo(progress: number): string {
  return `inset(0px ${(1 - progress) * 100}% 0px 0px)`;
}

function lineOpacity(root: HTMLElement, lineIndex: number): string | undefined {
  return root.querySelector<HTMLElement>(`[data-line-idx='${lineIndex}'][data-line-begin]`)?.style.opacity;
}

function viewportOf(root: HTMLElement): HTMLElement {
  const viewport = root.querySelector<HTMLElement>("[data-test='viewport']");
  if (!viewport) throw new Error("viewport missing");
  return viewport;
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("TimelinePreviewSidebar on the frame loop", () => {
  it("sweeps the word clip path while the audio plays", async () => {
    seedLines();
    const audioElement = attachAudio();
    const screen = await render(<Harness />);
    await expect.poll(() => wordSweep(screen.container, 0)).toBe(sweptTo(0));

    useAudioStore.getState().setIsPlaying(true);
    audioElement.currentTime = 1;

    await expect.poll(() => wordSweep(screen.container, 0)).toBe(sweptTo(0.5));
  });

  it("sweeps the word clip path after a seek while paused", async () => {
    seedLines();
    attachAudio();
    const screen = await render(<Harness />);
    await expect.poll(() => wordSweep(screen.container, 0)).toBe(sweptTo(0));

    useAudioStore.getState().seekTo(3);

    await expect.poll(() => wordSweep(screen.container, 1)).toBe(sweptTo(0.5));
    expect(wordSweep(screen.container, 0)).toBe(sweptTo(1));
  });

  it("moves a line through the upcoming, active and complete opacities", async () => {
    seedLines();
    attachAudio();
    const screen = await render(<Harness />);
    await expect.poll(() => lineOpacity(screen.container, 2)).toBe("0.3");

    useAudioStore.getState().seekTo(5);
    await expect.poll(() => lineOpacity(screen.container, 2)).toBe("1");

    useAudioStore.getState().seekTo(9);
    await expect.poll(() => lineOpacity(screen.container, 2)).toBe("0.6");
  });

  it("scrolls the active line into view", async () => {
    seedLines();
    attachAudio();
    const screen = await render(<Harness />);
    const viewport = viewportOf(screen.container);
    await expect.poll(() => lineOpacity(screen.container, 0)).toBe("1");
    expect(viewport.scrollTop).toBe(0);

    useAudioStore.getState().seekTo(25);

    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
  });

  describe("invariants", () => {
    it("regression #174: stops running frames once the audio is paused and idle", async () => {
      seedLines();
      attachAudio();
      const screen = await render(<Harness />);
      await expect.poll(() => lineOpacity(screen.container, 0)).toBe("1");
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });

    it("regression #174: stops running frames when there is nothing synced to preview", async () => {
      useProjectStore.setState({ lines: [] });
      await render(<Harness />);
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });
  });
});
