import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { DefaultPlaybackRateSetting } from "@/ui/settings/default-playback-rate-setting";

describe("DefaultPlaybackRateSetting", () => {
  it("shows the stored rate formatted as a multiplier", async () => {
    useSettingsStore.setState({ defaultPlaybackRate: 1.25 });
    const screen = await render(<DefaultPlaybackRateSetting />);
    await expect.element(screen.getByText("1.25x")).toBeInTheDocument();
  });

  it("copies the current playback rate from the keyboard when audio is loaded", async () => {
    useAudioStore.setState({ source: { type: "youtube", videoId: "abc" }, playbackRate: 1.5 });
    const screen = await render(<DefaultPlaybackRateSetting />);
    (screen.getByRole("button", { name: "Use current" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useSettingsStore.getState().defaultPlaybackRate).toBe(1.5);
  });

  describe("edge cases", () => {
    it("offers no Use current action without audio", async () => {
      useAudioStore.setState({ source: null });
      const screen = await render(<DefaultPlaybackRateSetting />);
      expect(screen.container.querySelector("button")).toBeNull();
    });
  });
});
