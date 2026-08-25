import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { bufferToBlobUrl, createAudioFile, makeSineBuffer } from "@/test/audio-fixtures";
import { installStyleSheet, POSITION_UTILITIES_CSS, WAVEFORM_SWEEP_CSS } from "@/test/browser-css";
import { createLine, createWord } from "@/test/factories";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// The user-visible property behind issue #174: an idle, paused timeline costs nothing. Every other
// guard in this PR names one known cause. This one watches the cost itself, so it also catches the
// causes nobody has thought of yet, whatever mechanism they arrive by.

// -- Constants -----------------------------------------------------------------

const AUDIO_DURATION_S = 2;
const PROJECT_DURATION_S = 60;
const LINE_COUNT = 12;
const IDLE_FRAMES = 30;
const PLAYBACK_FRAMES = 12;
const SCROLL_VIEWPORT_HEIGHT = 300;
const SETTLE_TIMEOUT_MS = 5000;

// -- Harness -------------------------------------------------------------------

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;
let styles: HTMLStyleElement[] = [];

function seedTimeline(): void {
  const audio = new Audio();
  audio.src = bufferToBlobUrl(makeSineBuffer(AUDIO_DURATION_S));
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: PROJECT_DURATION_S,
    currentTime: 0,
    isPlaying: false,
    audioElement: audio,
  });
  useTimelineStore.setState({ zoom: 100 });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: Array.from({ length: LINE_COUNT }, (_, i) =>
      createLine({
        id: `line-${i}`,
        text: `lyric line ${i}`,
        words: [
          createWord({ text: "lyric ", begin: i * 2, end: i * 2 + 0.5 }),
          createWord({ text: "line ", begin: i * 2 + 0.5, end: i * 2 + 1 }),
          createWord({ text: `${i}`, begin: i * 2 + 1, end: i * 2 + 1.5 }),
        ],
        backgroundText: i % 4 === 0 ? "ooh" : undefined,
        backgroundWords: i % 4 === 0 ? [createWord({ text: "ooh", begin: i * 2 + 0.2, end: i * 2 + 1.2 })] : undefined,
      }),
    ),
  });
}

function scrollContainer(): HTMLElement {
  const container = document.querySelector<HTMLElement>("[data-scroll-container]");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function loadingDots(): HTMLElement {
  const dots = document.querySelector<HTMLElement>("[data-waveform-loading-dots]");
  if (!dots) throw new Error("waveform loading layer missing");
  return dots;
}

async function renderIdleTimeline(): Promise<void> {
  seedTimeline();
  await render(<TimelinePanel />);
  const container = scrollContainer();
  container.style.height = `${SCROLL_VIEWPORT_HEIGHT}px`;
  container.style.overflow = "auto";

  await expect.poll(() => scrollContainer().querySelectorAll("[data-word-block]").length).toBeGreaterThan(0);
  await expect.poll(() => loadingDots().hasAttribute("data-sweeping"), { timeout: SETTLE_TIMEOUT_MS }).toBe(false);

  await probe.quiesce();
  await settleFrames(probe.count);
  expect(probe.count()).toBe(0);
}

// The shared loop routes its stepping through window.requestAnimationFrame too, so the frames the
// measurement itself needs have to come off a reference captured before the global is watched.
function stepCapturedFrames(raf: typeof window.requestAnimationFrame, count: number): Promise<void> {
  let chain = Promise.resolve();
  for (let stepped = 0; stepped < count; stepped++) {
    chain = chain.then(() => new Promise<void>((resolve) => raf.call(window, () => resolve())));
  }
  return chain;
}

function describeTarget(effect: AnimationEffect | null): string {
  if (!(effect instanceof KeyframeEffect) || !effect.target) return "(no target)";
  const classes = effect.target.getAttribute("class");
  return `<${effect.target.tagName.toLowerCase()}${classes ? ` class="${classes}"` : ""}>${effect.pseudoElement ?? ""}`;
}

function describeAnimation(animation: Animation): string {
  const name = animation instanceof CSSAnimation ? animation.animationName : animation.id || "(unnamed)";
  return `${name} on ${describeTarget(animation.effect)}`;
}

function runningInfiniteAnimations(): string[] {
  return document
    .getAnimations()
    .filter(
      (animation) =>
        animation.playState === "running" && animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY,
    )
    .map(describeAnimation);
}

beforeAll(() => {
  styles = [installStyleSheet(POSITION_UTILITIES_CSS), installStyleSheet(WAVEFORM_SWEEP_CSS)];
  for (const style of styles) expect(style.sheet?.cssRules.length).toBeGreaterThan(0);
});

afterAll(() => {
  for (const style of styles) style.remove();
  styles = [];
});

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

describe("timeline idle cost", () => {
  it("regression #174: schedules no animation frames while idle and paused", async () => {
    await renderIdleTimeline();

    const nativeRequestAnimationFrame = window.requestAnimationFrame;
    const schedulers: string[] = [];
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      schedulers.push(new Error("frame scheduled while idle").stack ?? "unknown scheduler");
      return nativeRequestAnimationFrame.call(window, callback);
    };

    try {
      await stepCapturedFrames(nativeRequestAnimationFrame, IDLE_FRAMES);
    } finally {
      window.requestAnimationFrame = nativeRequestAnimationFrame;
    }

    expect(schedulers.join("\n\n")).toBe("");
  });

  it("regression #174: runs no infinite animations while idle and paused", async () => {
    // A reduced-motion environment forces animation-iteration-count: 1 globally (src/index.css),
    // which would make the assertion below vacuous.
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
    await renderIdleTimeline();

    expect(runningInfiniteAnimations().join("\n")).toBe("");
  });

  it("still runs frames during playback", async () => {
    await renderIdleTimeline();

    useAudioStore.getState().setIsPlaying(true);
    await stepFrames(PLAYBACK_FRAMES);

    expect(probe.count()).toBeGreaterThan(PLAYBACK_FRAMES - 2);
  });
});
