import { restoreOpenProject } from "@/lib/open-project";
import { useAudioStore } from "@/stores/audio";
import { createUnplayableAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ImportPanel } from "@/views/import";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

describe("ImportPanel · missing audio", () => {
  it("shows the relink state when the project's file is not on this device", async () => {
    await seedStoredProject("p", {
      open: true,
      project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
    });
    await restoreOpenProject();
    const screen = await render(<ImportPanel />);
    await expect.element(screen.getByText("Not on this device. Your lyrics and timings are safe.")).toBeInTheDocument();
  });

  it("shows the normal drop zone for a project without audio", async () => {
    await seedStoredProject("p", { open: true, project: songTitled("Lyrics only") });
    await restoreOpenProject();
    const screen = await render(<ImportPanel />);
    await expect.element(screen.getByText("Drop audio file here")).toBeInTheDocument();
  });

  it("shows the YouTube relink state when the project's video fails to load", async () => {
    await seedStoredProject("p", {
      open: true,
      project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: "dQw4w9WgXcQ" } },
    });
    await restoreOpenProject();
    useAudioStore.getState().failYouTubeLoad("Nope");
    const screen = await render(<ImportPanel />);
    await expect.element(screen.getByText("Couldn't load the audio from YouTube.")).toBeInTheDocument();
    await expect.element(screen.getByText("Song")).toBeInTheDocument();
    await expect.element(screen.getByPlaceholder("Or load a different YouTube URL")).toBeInTheDocument();
  });

  describe("error paths", () => {
    it("keeps the normal drop zone when a fresh paste fails and the project expects no audio", async () => {
      useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ");
      useAudioStore.getState().failYouTubeLoad("Nope");
      const screen = await render(<ImportPanel />);
      await expect.element(screen.getByText("Drop audio file here")).toBeInTheDocument();
      expect(screen.getByText("Couldn't load the audio from YouTube.").elements()).toHaveLength(0);
    });

    it("keeps the relink state when a dropped file isn't playable", async () => {
      await seedStoredProject("p", {
        open: true,
        project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
      });
      await restoreOpenProject();
      const screen = await render(<ImportPanel />);
      await userEvent.upload(screen.getByLabelText("Upload audio file"), createUnplayableAudioFile());
      await expect
        .element(screen.getByText("Not on this device. Your lyrics and timings are safe."))
        .toBeInTheDocument();
      expect(useAudioStore.getState().source).toBeNull();
    });
  });
});
