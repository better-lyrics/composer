import type { KeepYouTubeAudio } from "@/domain/storage/audio-retention";
import { usePersistence } from "@/hooks/usePersistence";
import { startSongInNewProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { awaitInFlightSaves } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function openYouTubeProject(rule: KeepYouTubeAudio, bridgeEnabled: boolean): Promise<void> {
  useSettingsStore.setState({ keepYouTubeAudio: rule, experiments: { youtubeBridge: bridgeEnabled } });
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: VIDEO_ID } },
  });
  await render(<PersistenceHost />);
  await getPersistenceSettled();
}

async function receiveYouTubeAudio(): Promise<void> {
  useAudioStore.getState().setYouTubeFile(createAudioFile(`${VIDEO_ID}.opus`));
  await awaitInFlightSaves();
}

// -- Tests --------------------------------------------------------------------

describe("usePersistence · Keep YouTube audio", () => {
  it("stores YouTube audio automatically while the bridge is off", async () => {
    await openYouTubeProject("auto", false);
    await receiveYouTubeAudio();
    expect((await loadProjectAudio("p"))?.name).toBe(`${VIDEO_ID}.opus`);
  });

  it("does not store YouTube audio automatically while the bridge is on", async () => {
    await openYouTubeProject("auto", true);
    await receiveYouTubeAudio();
    expect(await loadProjectAudio("p")).toBeUndefined();
  });

  it("Always stores it even with the bridge on", async () => {
    await openYouTubeProject("always", true);
    await receiveYouTubeAudio();
    expect((await loadProjectAudio("p"))?.name).toBe(`${VIDEO_ID}.opus`);
  });

  it("Never stores it even with the bridge off", async () => {
    await openYouTubeProject("never", false);
    await receiveYouTubeAudio();
    expect(await loadProjectAudio("p")).toBeUndefined();
  });

  it("still plays the audio it does not store", async () => {
    await openYouTubeProject("never", false);
    await receiveYouTubeAudio();
    const source = useAudioStore.getState().source;
    expect(source?.type === "youtube" ? source.file?.name : null).toBe(`${VIDEO_ID}.opus`);
  });

  describe("edge cases", () => {
    it("always stores a local file, whatever the rule", async () => {
      await openYouTubeProject("never", true);
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("local.wav") });
      await awaitInFlightSaves();
      expect((await loadProjectAudio("p"))?.name).toBe("local.wav");
    });
  });

  describe("new project flows", () => {
    it("follows the rule on the first save of a brand-new project", async () => {
      useSettingsStore.setState({ keepYouTubeAudio: "always" });
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      useAudioStore.getState().setYouTubeSource(VIDEO_ID, createAudioFile(`${VIDEO_ID}.opus`));
      await awaitInFlightSaves();
      const id = openProjectIdSnapshot();
      expect(id).toBeDefined();
      expect((await loadProjectAudio(id ?? ""))?.name).toBe(`${VIDEO_ID}.opus`);
    });

    it("follows the rule for audio that arrives right after starting a new song", async () => {
      useSettingsStore.setState({ keepYouTubeAudio: "never" });
      await seedStoredProject("p", {
        open: true,
        project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: VIDEO_ID } },
      });
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      const started = await startSongInNewProject("New Song", (song) => song);
      useAudioStore.getState().setYouTubeSource(VIDEO_ID, createAudioFile(`${VIDEO_ID}.opus`));
      await awaitInFlightSaves();
      expect(await loadProjectAudio(started?.newId ?? "")).toBeUndefined();
    });
  });

  describe("regressions", () => {
    it("regression: replacing a stored file with YouTube audio that is not kept removes the old file", async () => {
      useSettingsStore.setState({ keepYouTubeAudio: "never" });
      await seedStoredProject("p", {
        open: true,
        audio: createAudioFile("old.wav"),
        project: { ...songTitled("Song"), audioSource: { kind: "file", name: "old.wav" } },
      });
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      useAudioStore.getState().setYouTubeSource(VIDEO_ID, createAudioFile(`${VIDEO_ID}.opus`));
      await awaitInFlightSaves();
      expect(await loadProjectAudio("p")).toBeUndefined();
    });

    it("regression: switching videos after the rule stops keeping audio clears the old file", async () => {
      await openYouTubeProject("always", false);
      await receiveYouTubeAudio();
      useSettingsStore.setState({ keepYouTubeAudio: "never" });
      useAudioStore.getState().setYouTubeSource("differentVideoId");
      await awaitInFlightSaves();
      expect(await loadProjectAudio("p")).toBeUndefined();
    });

    it("regression: clearing the source after the rule stops keeping audio clears the old file", async () => {
      await openYouTubeProject("always", false);
      await receiveYouTubeAudio();
      useSettingsStore.setState({ keepYouTubeAudio: "never" });
      useAudioStore.getState().setSource(null);
      await awaitInFlightSaves();
      expect(await loadProjectAudio("p")).toBeUndefined();
    });
  });
});
