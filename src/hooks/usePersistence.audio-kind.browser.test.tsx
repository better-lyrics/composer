import { usePersistence } from "@/hooks/usePersistence";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { awaitInFlightSaves } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function openProjectWith(audioSource: { kind: "file"; name: string } | { kind: "youtube"; videoId: string }) {
  useSettingsStore.setState({ autoSaveDelay: 60_000, keepYouTubeAudio: "always" });
  const fileName = audioSource.kind === "file" ? audioSource.name : `${audioSource.videoId}.opus`;
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("Song"), lines: [], audioSource },
    audio: createAudioFile(fileName),
  });
  await render(<PersistenceHost />);
  await getPersistenceSettled();
}

// -- Tests --------------------------------------------------------------------

describe("usePersistence · stored audio kind", () => {
  it("saves the new audio kind at once when a local file replaces YouTube audio in place", async () => {
    await openProjectWith({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("local.wav") });
    await expect.poll(async () => (await loadProjectIndexEntry("p"))?.audioKind).toBe("file");
    await awaitInFlightSaves();
    expect((await loadProjectAudio("p"))?.name).toBe("local.wav");
  });

  it("saves the new audio kind at once when YouTube audio replaces a local file in place", async () => {
    await openProjectWith({ kind: "file", name: "local.wav" });
    useAudioStore.getState().setYouTubeSource("dQw4w9WgXcQ", createAudioFile("dQw4w9WgXcQ.opus"));
    await expect.poll(async () => (await loadProjectIndexEntry("p"))?.audioKind).toBe("youtube");
    await awaitInFlightSaves();
  });

  describe("edge cases", () => {
    it("waits for the usual auto-save when only the file changes and the kind stays the same", async () => {
      await openProjectWith({ kind: "file", name: "old.wav" });
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("new.wav") });
      await awaitInFlightSaves();
      expect((await loadProjectAudio("p"))?.name).toBe("new.wav");
      expect((await loadProjectIndexEntry("p"))?.audioFileName).toBe("old.wav");
    });
  });
});
