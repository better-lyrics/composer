import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { PlaybackSection } from "@/ui/settings/playback-section";

describe("PlaybackSection", () => {
  it("shows the formatted default playback rate", async () => {
    useSettingsStore.setState({ defaultPlaybackRate: 0.75 });
    const screen = await render(<PlaybackSection />);
    await expect.element(screen.getByText("0.75x")).toBeInTheDocument();
  });

  it("flips Remember volume when its toggle is clicked", async () => {
    useSettingsStore.setState({ rememberVolume: true });
    const screen = await render(<PlaybackSection />);
    await screen.getByRole("switch").click();
    await expect.poll(() => useSettingsStore.getState().rememberVolume).toBe(false);
  });

  it("hides the Use current action when no audio is loaded", async () => {
    const screen = await render(<PlaybackSection />);
    await expect.element(screen.getByRole("button", { name: "Use current" })).not.toBeInTheDocument();
  });

  it("adopts the live playback rate when Use current is clicked", async () => {
    useAudioStore.setState({ source: { type: "youtube", videoId: "abc" }, playbackRate: 1.5 });
    const screen = await render(<PlaybackSection />);
    await screen.getByRole("button", { name: "Use current" }).click();
    await expect.poll(() => useSettingsStore.getState().defaultPlaybackRate).toBe(1.5);
  });
});
