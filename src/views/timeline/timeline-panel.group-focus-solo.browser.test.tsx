import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { bufferToBlobUrl, createAudioFile, makeSineBuffer } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 0.2 }),
      createWord({ text: "now", begin: begin + 0.2, end: begin + 0.4 }),
    ],
  });

let audio: HTMLAudioElement;

beforeEach(async () => {
  audio = document.createElement("audio");
  audio.muted = true;
  audio.src = bufferToBlobUrl(makeSineBuffer(6));
  document.body.append(audio);
  await new Promise((resolve) => audio.addEventListener("loadedmetadata", resolve, { once: true }));
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 6, audioElement: audio });
  useProjectStore.setState({
    activeTab: "timeline",
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
    lines: [chorus(0, 1), chorus(1, 3)],
  });
});

afterEach(() => {
  audio.pause();
  audio.remove();
});

async function openSolo(instanceIdx: number) {
  const screen = await render(<TimelinePanel />);
  useTimelineStore.getState().openGroup("g1", instanceIdx);
  await expect.poll(() => document.querySelector("[data-group-focus-bar]")).not.toBeNull();
  return screen;
}

const focus = () => useTimelineStore.getState().focusedGroup;

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · open group playback", () => {
  it("starts playback at the open instance when the playhead is outside it", async () => {
    await openSolo(1);
    audio.currentTime = 0.5;

    await audio.play();

    await expect.poll(() => audio.currentTime).toBeGreaterThanOrEqual(3);
    expect(focus()).not.toBeNull();
  });

  it("stops at the end of the instance and returns to its start", async () => {
    await openSolo(0);
    audio.currentTime = 1;

    useAudioStore.setState({ isPlaying: true });
    await audio.play();

    await expect.poll(() => useAudioStore.getState().isPlaying, { timeout: 3000 }).toBe(false);
    await expect.poll(() => audio.currentTime).toBeCloseTo(1, 1);
    expect(focus()).not.toBeNull();
  });

  it("loops the instance when looping is on", async () => {
    useSettingsStore.setState({ loopOpenGroup: true });
    await openSolo(0);
    audio.currentTime = 1.3;
    let wrapped = false;
    audio.addEventListener("seeked", () => {
      if (audio.currentTime < 1.2) wrapped = true;
    });

    await audio.play();

    await expect.poll(() => wrapped, { timeout: 3000 }).toBe(true);
    expect(audio.paused).toBe(false);
  });

  it("regression: stays open when the playhead moves outside, and play returns to the instance", async () => {
    await openSolo(0);

    const seeked = new Promise((resolve) => audio.addEventListener("seeked", resolve, { once: true }));
    useAudioStore.getState().seekTo(4.5);
    await seeked;
    await audio.play();

    await expect.poll(() => audio.currentTime).toBeLessThan(1.5);
    expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 0 });
  });

  describe("keyboard", () => {
    it("toggles looping with Shift+L while a group is open", async () => {
      await openSolo(0);

      await userEvent.keyboard("{Shift>}L{/Shift}");

      expect(useSettingsStore.getState().loopOpenGroup).toBe(true);
    });

    it("leaves Shift+L alone while no group is open", async () => {
      await render(<TimelinePanel />);

      await userEvent.keyboard("{Shift>}L{/Shift}");

      expect(useSettingsStore.getState().loopOpenGroup).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("keeps the solo when switching to another instance moves the playhead there", async () => {
      await openSolo(0);
      useAudioStore.getState().seekTo(1.1);
      await expect.poll(() => audio.currentTime).toBeCloseTo(1.1, 1);

      const { hearInstance } = await import("@/views/timeline/hear-instance");
      hearInstance("g1", 0, 1);

      await expect.poll(() => audio.currentTime).toBeCloseTo(3.1, 1);
      expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
    });
  });
});
