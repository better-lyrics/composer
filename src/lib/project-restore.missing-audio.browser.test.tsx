import { usePersistence } from "@/hooks/usePersistence";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function openWithPersistence(): Promise<void> {
  await render(<PersistenceHost />);
  await getPersistenceSettled();
}

// -- Tests --------------------------------------------------------------------

describe("restoring a project whose audio is not on this device", () => {
  it("expects the missing local file and has no source", async () => {
    await seedStoredProject("p", {
      open: true,
      project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
    });
    await openWithPersistence();
    expect(useAudioStore.getState().source).toBeNull();
    expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "file", name: "city.wav" });
  });

  it("expects YouTube audio it has to fetch", async () => {
    await seedStoredProject("p", {
      open: true,
      project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: "dQw4w9WgXcQ" } },
    });
    await openWithPersistence();
    expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  describe("edge cases", () => {
    it("expects nothing when the audio is stored", async () => {
      await seedStoredProject("p", {
        open: true,
        audio: createAudioFile("city.wav"),
        project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
      });
      await openWithPersistence();
      expect(useAudioStore.getState().expectedAudio).toBeNull();
    });

    it("expects nothing for a project that never had audio", async () => {
      await seedStoredProject("p", { open: true, project: songTitled("Lyrics only") });
      await openWithPersistence();
      expect(useAudioStore.getState().expectedAudio).toBeNull();
    });
  });

  describe("regressions", () => {
    it("regression: editing a project whose file is missing never drops its audio source", async () => {
      await seedStoredProject("p", {
        open: true,
        project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
      });
      await openWithPersistence();
      useProjectStore.getState().setMetadata({ title: "City (edited)" });
      await flushPendingSave();
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "city.wav" });
      expect(await loadProjectIndexEntry("p")).toMatchObject({ audioKind: "file", storedAudioBytes: 0 });
    });
  });
});
