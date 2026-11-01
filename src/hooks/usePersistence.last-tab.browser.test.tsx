import { beforeEach, describe, expect, it } from "vitest";
import { usePersistence } from "@/hooks/usePersistence";
import { findOpenProjectId } from "@/lib/open-project-session";
import { cancelPendingSave, flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function openProjectEntry() {
  const id = await findOpenProjectId();
  return id ? loadProjectIndexEntry(id) : undefined;
}

beforeEach(() => {
  cancelPendingSave();
  useSettingsStore.getState().set("autoSaveDelay", 60_000);
});

// -- Tests --------------------------------------------------------------------

describe("usePersistence: last tab", () => {
  it("remembers a tab picked after the upload but before the first record save", async () => {
    await render(<PersistenceHost />);
    await getPersistenceSettled();
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
    await expect.poll(async () => (await openProjectEntry()) ?? (await findOpenProjectId())).toBeTruthy();
    useProjectStore.getState().setActiveTab("edit");
    useProjectStore.getState().setMetadata({ title: "Alpha" });
    await flushPendingSave();
    expect((await openProjectEntry())?.lastTab).toBe("edit");
  });

  describe("edge cases", () => {
    it("remembers a tab picked before the project has an id", async () => {
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      expect(await findOpenProjectId()).toBeUndefined();
      useProjectStore.getState().setActiveTab("sync");
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      await flushPendingSave();
      expect((await openProjectEntry())?.lastTab).toBe("sync");
    });

    it("records the tab current at save time, not when the edit was queued", async () => {
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      useProjectStore.getState().setActiveTab("timeline");
      await flushPendingSave();
      expect((await openProjectEntry())?.lastTab).toBe("timeline");
    });
  });

  describe("invariants", () => {
    it("keeps the remembered tab when a later save runs", async () => {
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      useProjectStore.getState().setActiveTab("preview");
      await flushPendingSave();
      useProjectStore.getState().setMetadata({ title: "Alpha 2" });
      await flushPendingSave();
      expect((await openProjectEntry())?.lastTab).toBe("preview");
    });
  });
});
