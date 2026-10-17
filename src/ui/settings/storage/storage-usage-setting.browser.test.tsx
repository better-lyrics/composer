import { putStem } from "@/audio/separation/stem-store";
import { saveProjectAudio } from "@/lib/project-audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { StorageUsageSetting } from "@/ui/settings/storage/storage-usage-setting";
import { formatFileSize } from "@/utils/format-file-size";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("StorageUsageSetting", () => {
  it("shows an empty device by default", async () => {
    const screen = await render(<StorageUsageSetting />);
    await expect.element(screen.getByText("used on this device")).toBeInTheDocument();
    await expect
      .poll(() =>
        screen
          .getByRole("definition")
          .elements()
          .map((element) => element.textContent),
      )
      .toEqual(["0 B", "0 B", "0 B", "0 B"]);
  });

  it("counts stems and unindexed audio into the total", async () => {
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(16)]));
    const audio = createAudioFile("song.wav");
    await saveProjectAudio("fresh", audio);
    const screen = await render(<StorageUsageSetting />);
    await expect.element(screen.getByRole("definition").filter({ hasText: "16 B" })).toBeInTheDocument();
    await expect
      .element(screen.getByRole("definition").filter({ hasText: formatFileSize(audio.size) }))
      .toBeInTheDocument();
    const usedOnDevice = screen.getByText("used on this device");
    await expect.element(usedOnDevice).toBeInTheDocument();
    expect(usedOnDevice.element().parentElement?.textContent).toBe(
      `${formatFileSize(16 + audio.size)}used on this device`,
    );
  });

  it("renders nothing until the project index and the storage report resolve", async () => {
    const screen = await render(<StorageUsageSetting />);
    expect(screen.container.textContent).toBe("");
    await expect.element(screen.getByText("used on this device")).toBeInTheDocument();
  });

  it("marks YouTube audio as not stored when the rule discards it", async () => {
    useSettingsStore.setState({ keepYouTubeAudio: "never" });
    const screen = await render(<StorageUsageSetting />);
    await expect.element(screen.getByRole("definition").filter({ hasText: "Not stored" })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("keeps YouTube audio marked as stored when the automatic rule keeps it with the bridge off", async () => {
      useSettingsStore.setState({ keepYouTubeAudio: "auto", experiments: { youtubeBridge: false } });
      const screen = await render(<StorageUsageSetting />);
      await expect.element(screen.getByRole("term").filter({ hasText: "YouTube audio" })).toBeInTheDocument();
      const definitions = screen
        .getByRole("definition")
        .elements()
        .map((element) => element.textContent);
      expect(definitions).not.toContain("Not stored");
    });
  });
});
