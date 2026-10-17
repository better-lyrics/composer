import { render } from "@/test/render";
import { AudioStatusLabel } from "@/views/library/audio-status-label";
import { describe, expect, it } from "vitest";

describe("AudioStatusLabel", () => {
  it("shows the format and size of stored audio", async () => {
    const screen = await render(
      <AudioStatusLabel project={{ audioKind: "file", storedAudioBytes: 43_830_067, audioFileName: "a.flac" }} />,
    );
    await expect.element(screen.getByText("FLAC")).toBeInTheDocument();
    await expect.element(screen.getByText("41.8 MB")).toBeInTheDocument();
  });

  it("names YouTube audio", async () => {
    const screen = await render(<AudioStatusLabel project={{ audioKind: "youtube", storedAudioBytes: 0 }} />);
    await expect.element(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("warns about missing audio", async () => {
    const screen = await render(
      <AudioStatusLabel project={{ audioKind: "file", storedAudioBytes: 0, audioFileName: "ghost_town.m4a" }} />,
    );
    await expect.element(screen.getByText("Audio missing")).toHaveClass("text-composer-warning");
  });

  describe("edge cases", () => {
    it("says there is no audio", async () => {
      const screen = await render(<AudioStatusLabel project={{ audioKind: "none", storedAudioBytes: 0 }} />);
      await expect.element(screen.getByText("No audio")).toBeInTheDocument();
    });

    it("hides the size in the compact card footer", async () => {
      const screen = await render(
        <AudioStatusLabel compact project={{ audioKind: "file", storedAudioBytes: 2048, audioFileName: "a.mp3" }} />,
      );
      await expect.element(screen.getByText("MP3")).toBeInTheDocument();
      expect(screen.container.textContent).not.toContain("KB");
    });
  });
});
