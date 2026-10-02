import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { isCountingIn } from "@/lib/sync-count-in";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { SyncPanel } from "@/views/sync/sync-panel";

function load(lines: LyricLine[], countIn: number): void {
  useSettingsStore.setState({ syncCountIn: countIn });
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 60,
    currentTime: 0,
    isPlaying: false,
  });
  useProjectStore.setState({ lines, activeTab: "sync", granularity: "word" });
}

function key(init: KeyboardEventInit, type: "keydown" | "keyup" = "keydown"): void {
  window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
}

const space = () => key({ key: " ", code: "Space" });
const isPlaying = () => useAudioStore.getState().isPlaying;
const words = () => useProjectStore.getState().lines[0].words ?? [];

describe("Sync count-in", () => {
  it("counts in before playback starts when sync begins", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 1);
    await render(<SyncPanel />);
    space();
    expect(isCountingIn()).toBe(true);
    expect(isPlaying()).toBe(false);
    await expect.poll(isPlaying, { timeout: 2500 }).toBe(true);
    expect(isCountingIn()).toBe(false);
  });

  it("ignores taps while counting", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 3);
    await render(<SyncPanel />);
    space();
    space();
    space();
    expect(isCountingIn()).toBe(true);
    expect(words()).toEqual([]);
  });

  it("does not start a hold while counting", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 3);
    await render(<SyncPanel />);
    key({ key: "f", code: "KeyF" });
    expect(isCountingIn()).toBe(true);
    key({ key: "f", code: "KeyF" }, "keyup");
    expect(words()).toEqual([]);
    expect(isCountingIn()).toBe(true);
  });

  it("shows the intro dots in the carousel and the countdown in the footer", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 3);
    const screen = await render(<SyncPanel />);
    space();
    await expect.poll(() => screen.container.querySelector("[data-count-in-dots]")).not.toBeNull();
    await expect.poll(() => screen.container.textContent).toContain("close");
    await expect.element(screen.getByText("Starting in", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole("status").filter({ hasText: "Starting in" })).toHaveTextContent("Starting in 3");
  });

  it("cancels on Escape and stays paused", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 1);
    const screen = await render(<SyncPanel />);
    space();
    await expect.poll(() => screen.container.querySelector("[data-count-in-dots]")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isCountingIn()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(isPlaying()).toBe(false);
    await expect.poll(() => screen.container.querySelector("[data-count-in-dots]")).toBeNull();
  });

  it("cancels when Sync goes away", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 3);
    const screen = await render(<SyncPanel />);
    space();
    expect(isCountingIn()).toBe(true);
    await screen.unmount();
    expect(isCountingIn()).toBe(false);
  });

  it("clears the dots once playback starts", async () => {
    load([createLine({ id: "l0", text: "Hold me close" })], 1);
    const screen = await render(<SyncPanel />);
    space();
    await expect.poll(isPlaying, { timeout: 2500 }).toBe(true);
    await expect.poll(() => screen.container.querySelector("[data-count-in-dots]")).toBeNull();
    await expect.element(screen.getByText("Starting in", { exact: true })).not.toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("starts playback at once when the count-in is off", async () => {
      load([createLine({ id: "l0", text: "Hold me close" })], 0);
      await render(<SyncPanel />);
      space();
      expect(isCountingIn()).toBe(false);
      expect(isPlaying()).toBe(true);
    });
  });
});
