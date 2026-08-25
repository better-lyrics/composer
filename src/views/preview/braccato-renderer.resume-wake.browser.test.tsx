import type { BraccatoLyricsElement } from "@braccato/core/element";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer, RESUME_AFFORDANCE_WAKE_MS } from "@/views/preview/braccato-renderer";

// -- Constants -----------------------------------------------------------------

const ACTIVE_LYRIC_TIME_S = 14;
const SCROLL_EVENTS = 5;
const IDLE_FRAMES = 30;
const SECOND_SCROLL_AT_MS = 1000;
const PAUSE_AFTER_SCROLL_MS = 1000;

// -- Harness -------------------------------------------------------------------

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;

function braccatoElement(container: Element): BraccatoLyricsElement {
  const el = container.querySelector("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  return el as BraccatoLyricsElement;
}

async function waitForLyrics(el: BraccatoLyricsElement): Promise<void> {
  await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
}

function resumeButton(container: Element): HTMLButtonElement | null {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Resume autoscroll")) ?? null;
}

function scrollAway(el: BraccatoLyricsElement): void {
  // Braccato swallows the scrolls it performed itself one at a time, so a real one has to outlast them.
  for (let i = 0; i < SCROLL_EVENTS; i++) el.dispatchEvent(new Event("scroll"));
}

async function renderPreview(isPlaying: boolean) {
  const audio = new Audio();
  audio.currentTime = ACTIVE_LYRIC_TIME_S;
  useAudioStore.setState({ audioElement: audio, isPlaying });

  const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
  const el = braccatoElement(screen.container);
  await waitForLyrics(el);
  return { screen, el };
}

async function renderPausedPreview() {
  return renderPreview(false);
}

async function renderPlayingPreview() {
  return renderPreview(true);
}

// Braccato's resume deadline is 25 s of wall clock. Faking setTimeout and Date is the only way
// to cross it in a test; animation frames stay real, so the frames the wake schedules are real.
function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  vi.useRealTimers();
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
  for (const el of document.querySelectorAll("#composer-audio")) el.remove();
});

// -- Tests ---------------------------------------------------------------------

describe("BraccatoRenderer resume affordance", () => {
  it("clears the affordance on braccato's own deadline, with the loop asleep in between", async () => {
    const { screen, el } = await renderPausedPreview();
    useFakeClock();

    const timersBefore = vi.getTimerCount();
    scrollAway(el);
    expect(vi.getTimerCount()).toBe(timersBefore + 1);
    await settleFrames(probe.count);
    expect(resumeButton(screen.container)).not.toBeNull();

    const quietBaseline = probe.count();
    await stepFrames(IDLE_FRAMES);
    expect(probe.count()).toBe(quietBaseline);

    vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS);
    await settleFrames(probe.count);
    expect(probe.count()).toBeGreaterThan(quietBaseline);
    expect(resumeButton(screen.container)).toBeNull();

    vi.useRealTimers();
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  it("costs a handful of frames rather than the whole wait", async () => {
    const { screen, el } = await renderPausedPreview();
    useFakeClock();

    scrollAway(el);
    await settleFrames(probe.count);
    const quietBaseline = probe.count();

    vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS);
    const woken = (await settleFrames(probe.count)) - quietBaseline;

    expect(woken).toBeGreaterThan(0);
    expect(woken).toBeLessThan(IDLE_FRAMES);
    expect(resumeButton(screen.container)).toBeNull();
  });

  describe("edge cases", () => {
    it("re-arms on a second scroll rather than stacking the first wake", async () => {
      const { screen, el } = await renderPausedPreview();
      useFakeClock();

      const timersBefore = vi.getTimerCount();
      scrollAway(el);
      vi.advanceTimersByTime(SECOND_SCROLL_AT_MS);
      scrollAway(el);
      expect(vi.getTimerCount()).toBe(timersBefore + 1);
      await settleFrames(probe.count);
      const quietBaseline = probe.count();

      // Past the wake the first scroll asked for, short of the one the second scroll asked for.
      vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS - SECOND_SCROLL_AT_MS / 2);
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(quietBaseline);
      expect(resumeButton(screen.container)).not.toBeNull();

      vi.advanceTimersByTime(SECOND_SCROLL_AT_MS);
      await settleFrames(probe.count);
      expect(resumeButton(screen.container)).toBeNull();
    });

    it("arms the wake while the song is playing too", async () => {
      const { screen, el } = await renderPlayingPreview();
      useFakeClock();

      const timersBefore = vi.getTimerCount();
      scrollAway(el);
      expect(vi.getTimerCount()).toBe(timersBefore + 1);
      await stepFrames(IDLE_FRAMES);
      expect(resumeButton(screen.container)).not.toBeNull();

      vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS);
      await stepFrames(IDLE_FRAMES);

      expect(resumeButton(screen.container)).toBeNull();
    });
  });

  describe("regressions", () => {
    it("regression: clears the affordance when the reader scrolls while playing and then pauses", async () => {
      const { screen, el } = await renderPlayingPreview();
      useFakeClock();

      scrollAway(el);
      await stepFrames(IDLE_FRAMES);
      expect(resumeButton(screen.container)).not.toBeNull();

      vi.advanceTimersByTime(PAUSE_AFTER_SCROLL_MS);
      useAudioStore.setState({ isPlaying: false });
      await settleFrames(probe.count);
      expect(resumeButton(screen.container)).not.toBeNull();

      const quietBaseline = probe.count();
      await stepFrames(IDLE_FRAMES);
      expect(probe.count()).toBe(quietBaseline);

      vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS);
      await settleFrames(probe.count);

      expect(resumeButton(screen.container)).toBeNull();
      expect(probe.count()).toBeGreaterThan(quietBaseline);
    });
  });

  describe("invariants", () => {
    it("leaves no pending wake behind when the reader resumes by hand", async () => {
      const { screen, el } = await renderPausedPreview();
      useFakeClock();

      scrollAway(el);
      await settleFrames(probe.count);
      resumeButton(screen.container)?.click();
      await settleFrames(probe.count);
      expect(resumeButton(screen.container)).toBeNull();

      const quietBaseline = probe.count();
      vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS * 2);
      await stepFrames(IDLE_FRAMES);

      expect(probe.count()).toBe(quietBaseline);
    });

    it("leaves no pending wake behind when the preview unmounts", async () => {
      const { screen, el } = await renderPausedPreview();
      useFakeClock();

      scrollAway(el);
      await settleFrames(probe.count);
      screen.unmount();
      await settleFrames(probe.count);

      const quietBaseline = probe.count();
      vi.advanceTimersByTime(RESUME_AFFORDANCE_WAKE_MS * 2);
      await stepFrames(IDLE_FRAMES);

      expect(probe.count()).toBe(quietBaseline);
    });
  });
});
