import { seekInPlaceToResume } from "@/audio/seek-reveal-intent";
import { playFromCue, returnAfterStop } from "@/lib/replay-cue";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { centerTimeScrollLeft } from "@/views/timeline/coords";
import { useSeekReveal } from "@/views/timeline/use-seek-reveal";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

function buildScrollContainer(width: number, contentWidth: number): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.overflow = "auto";
  const spacer = document.createElement("div");
  spacer.style.width = `${contentWidth}px`;
  spacer.style.height = "10px";
  container.appendChild(spacer);
  document.body.appendChild(container);
  return container;
}

async function loadedAudio(seconds: number): Promise<HTMLAudioElement> {
  const audio = new Audio(URL.createObjectURL(createAudioFile("song.wav", seconds)));
  await new Promise((resolve) => audio.addEventListener("loadedmetadata", resolve, { once: true }));
  return audio;
}

async function revealSetup(width: number) {
  const container = buildScrollContainer(width, 8000);
  const ref = createRef<HTMLDivElement | null>();
  ref.current = container;
  const audio = await loadedAudio(80);
  useAudioStore.setState({ audioElement: audio, duration: 80, currentTime: 0 });
  useProjectStore.setState({ activeTab: "timeline" });
  useSettingsStore.setState({ followPlayhead: false });
  useTimelineStore.setState({ zoom: 100 });
  await renderHook(() => useSeekReveal(ref, true));
  return container;
}

describe("useSeekReveal", () => {
  it("scrolls an off-screen seek target back into view", async () => {
    const container = await revealSetup(300);

    useAudioStore.getState().seekTo(50);

    await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
    container.remove();
  });

  it("leaves the scroll position alone when the seek target is already visible", async () => {
    const container = await revealSetup(600);
    let seeked = false;
    useAudioStore.getState().audioElement?.addEventListener("seeked", () => {
      seeked = true;
    });

    useAudioStore.getState().seekTo(2);

    await expect.poll(() => seeked).toBe(true);
    expect(container.scrollLeft).toBe(0);
    container.remove();
  });

  it("regression: leaves the view where the user scrolled it when play seeks in place to resume", async () => {
    const container = await revealSetup(300);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
    let seeks = 0;
    audio.addEventListener("seeked", () => {
      seeks++;
    });
    useAudioStore.getState().seekTo(50);
    await expect.poll(() => seeks).toBe(1);
    container.scrollLeft = 0;

    audio.muted = true;
    seekInPlaceToResume(audio);
    await audio.play();

    await expect.poll(() => seeks).toBe(2);
    expect(container.scrollLeft).toBe(0);
    audio.pause();
    container.remove();
  });

  it("regression: still reveals a seek made while paused that lands on the paused time", async () => {
    const container = await revealSetup(300);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
    let seeks = 0;
    audio.addEventListener("seeked", () => {
      seeks++;
    });
    useAudioStore.getState().seekTo(50);
    await expect.poll(() => seeks).toBe(1);
    container.scrollLeft = 0;

    useAudioStore.getState().seekTo(50);

    await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
    container.remove();
  });

  it("regression: reveals a seek during playback that lands where playback last rested, such as replay from cue", async () => {
    const container = await revealSetup(300);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
    let seeks = 0;
    audio.addEventListener("seeked", () => {
      seeks++;
    });
    useAudioStore.getState().seekTo(50);
    await expect.poll(() => seeks).toBe(1);
    audio.muted = true;
    await audio.play();
    container.scrollLeft = 0;

    useAudioStore.getState().seekTo(50);

    await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
    audio.pause();
    container.remove();
  });

  it.each([
    ["returning to it after a stop", returnAfterStop],
    ["playing from it", playFromCue],
  ])("centres the cue like Jump to playhead when %s, even with the cue on screen", async (_label, toCue) => {
    const container = await revealSetup(600);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
    let seeks = 0;
    audio.addEventListener("seeked", () => {
      seeks++;
    });
    useAudioStore.getState().seekTo(2);
    await expect.poll(() => seeks).toBe(1);
    useSettingsStore.setState({ returnToCue: true });
    useTimelineStore.getState().setCue(5.123456789);

    toCue();

    await expect.poll(() => container.scrollLeft).toBeCloseTo(centerTimeScrollLeft(5.123456789, 100, 600), 0);
    container.remove();
  });
});
