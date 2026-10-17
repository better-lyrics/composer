import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { firstBegin, jumpToRow, key, lineById, load, song, tapAt, undo } from "@/test/shared-timing-sync";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { beforeEach, describe, expect, it } from "vitest";

// These tests cover gestures after playback starts, not the count-in before it.
beforeEach(() => {
  useSettingsStore.setState({ syncCountIn: 0 });
});

describe("SyncPanel · skip past a placed instance", () => {
  it("jumps playback to the pre-roll before the placed instance ends", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(useAudioStore.getState().currentTime).toBe(42 - useSettingsStore.getState().redoPreroll);
  });

  it("follows the re-record pre-roll setting", async () => {
    useSettingsStore.setState({ redoPreroll: 0.5 });
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(useAudioStore.getState().currentTime).toBe(41.5);
  });

  it("never seeks on a normal tap", async () => {
    load(song());
    await render(<SyncPanel />);
    await tapAt(10, () => lineById("c0-0")?.words?.length);
    await tapAt(10.5, () => lineById("c0-0")?.words?.length);
    expect(useAudioStore.getState().currentTime).toBe(10.5);
  });

  it("does not seek back on undo", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await undo(() => firstBegin("c1-0"));
    expect(useAudioStore.getState().currentTime).toBe(40.5);
  });

  it("shows the pre-roll countdown to the next line in the footer", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("1.5", { exact: true })).toBeInTheDocument();
  });

  it("clears the pre-roll countdown on the next tap", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    await tapAt(42.1, () => firstBegin("v2"));
    await expect.element(screen.getByText("Line 6 in", { exact: true })).not.toBeInTheDocument();
  });

  it("hides the pre-roll countdown once playback reaches the next line", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    setCurrentTime(42);
    await expect.element(screen.getByText("Line 6 in", { exact: true })).not.toBeInTheDocument();
  });

  it("shows the pre-roll countdown after a hold places the instance", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    setCurrentTime(40);
    key({ key: "f", code: "KeyF" });
    await expect.poll(() => firstBegin("c1-0")).toBe(40);
    key({ key: "f", code: "KeyF" }, "keyup");
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    expect(useAudioStore.getState().currentTime).toBe(40.5);
  });

  it("hides the pre-roll countdown while paused", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    setIsPlaying(false);
    await expect.element(screen.getByText("Line 6 in", { exact: true })).not.toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("shows no pre-roll countdown on a normal tap", async () => {
      load(song());
      const screen = await render(<SyncPanel />);
      await tapAt(10, () => lineById("c0-0")?.words?.length);
      expect(screen.container.textContent).not.toMatch(/Line \d+ in/);
    });

    it("does not seek when the instance ends inside the pre-roll", async () => {
      useSettingsStore.setState({ redoPreroll: 5 });
      load(song({ first: "word", verse: "word" }));
      const screen = await render(<SyncPanel />);
      await jumpToRow(screen, 3);
      await tapAt(40, () => firstBegin("c1-0"));
      expect(useAudioStore.getState().currentTime).toBe(40);
    });
  });
});

describe("SyncPanel · skip past a placed instance · regressions", () => {
  it("regression: shows no countdown when the placed instance ends the song", async () => {
    load(song({ first: "word", verse: "word" }).filter((line) => line.id !== "v2"));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    expect(useAudioStore.getState().currentTime).toBe(40.5);
    expect(screen.container.textContent).not.toMatch(/Line \d+ in/);
  });

  it("regression: undo during the pre-roll removes the countdown", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    await undo(() => firstBegin("c1-0"));
    await expect.element(screen.getByText(/Line \d+ in/)).not.toBeInTheDocument();
  });

  it("regression: seeking past the next line removes the countdown", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    setCurrentTime(55);
    await expect.element(screen.getByText("Line 6 in", { exact: true })).not.toBeInTheDocument();
  });
});

describe("SyncPanel · skip past a placed instance · invariants", () => {
  it("keeps the countdown across a playback rate change, it counts audio time", async () => {
    load(song({ first: "word", verse: "word" }));
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 3);
    await tapAt(40, () => firstBegin("c1-0"));
    useAudioStore.setState({ playbackRate: 0.5 });
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("1.5", { exact: true })).toBeInTheDocument();
  });
});
