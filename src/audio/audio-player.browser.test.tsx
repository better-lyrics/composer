import { AudioPlayer } from "@/audio/audio-player";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

function setupAudioSource() {
  const file = createAudioFile("track.wav");
  useAudioStore.setState({
    source: { type: "file", file },
    duration: 60,
    currentTime: 5,
    isPlaying: false,
    playbackRate: 1,
    volume: 0.8,
    isMuted: false,
  });
  useSettingsStore.setState({ preservePitch: true });
}

describe("AudioPlayer", () => {
  it("renders nothing when there is no audio source", async () => {
    useAudioStore.setState({ source: null });
    const screen = await render(<AudioPlayer />);
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("renders play/pause and time display when a source is loaded", async () => {
    setupAudioSource();
    const screen = await render(<AudioPlayer />);
    await expect.element(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("0:05");
  });

  it("toggles play state when the play button is clicked", async () => {
    setupAudioSource();
    const screen = await render(<AudioPlayer />);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    await screen.getByRole("button", { name: "Play" }).click();
    expect(useAudioStore.getState().isPlaying).toBe(true);
    await screen.getByRole("button", { name: "Pause" }).click();
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });

  it("opens the playback rate popover and applies a preset", async () => {
    setupAudioSource();
    const screen = await render(<AudioPlayer />);
    await screen.getByRole("button", { name: /1\.00x/ }).click();
    await screen.getByRole("button", { name: "1.5x" }).click();
    expect(useAudioStore.getState().playbackRate).toBeCloseTo(1.5, 5);
  });

  it("remembers whether pitch is preserved when playback speed changes", async () => {
    setupAudioSource();
    const screen = await render(<AudioPlayer />);
    await screen.getByRole("button", { name: /1\.00x/ }).click();

    const toggle = screen.getByRole("switch", { name: "Preserve pitch" });
    await expect.element(toggle).toBeChecked();
    await toggle.click();

    expect(useSettingsStore.getState().preservePitch).toBe(false);
    const persisted = JSON.parse(localStorage.getItem("composer-settings") ?? "{}") as {
      state?: { preservePitch?: boolean };
    };
    expect(persisted.state?.preservePitch).toBe(false);
  });

  it("opens the volume popover and toggles mute", async () => {
    setupAudioSource();
    const screen = await render(<AudioPlayer />);
    await screen.getByRole("button", { name: "Volume" }).click();
    await screen.getByRole("button", { name: "Mute" }).click();
    expect(useAudioStore.getState().isMuted).toBe(true);
  });

  it("marks the open group on the seek bar only on the Timeline tab", async () => {
    setupAudioSource();
    useProjectStore.setState({
      activeTab: "timeline",
      groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
      lines: [
        createLine({
          id: "c0",
          text: "go",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [createWord({ text: "go", begin: 15, end: 30 })],
        }),
      ],
    });
    const screen = await render(<AudioPlayer />);
    const band = () => document.querySelector<HTMLElement>("[data-seek-bar-focus-band]");
    expect(band()).toBeNull();

    useTimelineStore.getState().openGroup("g1", 0);
    await expect.poll(() => band()?.style.left).toBe("25%");
    expect(band()?.style.width).toBe("25%");
    expect(screen.getByRole("slider", { name: "Audio progress" }).element().contains(band())).toBe(true);

    useProjectStore.setState({ activeTab: "preview" });
    await expect.poll(band).toBeNull();
  });
});
