import { beforeEach, describe, expect, it } from "vitest";
import { usePersistence } from "@/hooks/usePersistence";
import { openProject } from "@/lib/open-project";
import { findOpenProjectId } from "@/lib/open-project-session";
import { cancelPendingSave, flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { flushResumePosition } from "@/lib/resume-position";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function openProjectEntry() {
  const id = await findOpenProjectId();
  return id ? loadProjectIndexEntry(id) : undefined;
}

async function startSavedProject(): Promise<void> {
  await render(<PersistenceHost />);
  await getPersistenceSettled();
  useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
  useProjectStore.getState().setMetadata({ title: "Alpha" });
  await flushPendingSave();
  await expect.poll(openProjectEntry).toBeTruthy();
}

beforeEach(() => {
  cancelPendingSave();
  useSettingsStore.getState().set("autoSaveDelay", 60_000);
});

// -- Tests --------------------------------------------------------------------

describe("usePersistence: resume position", () => {
  it("remembers the playhead and zoom when playback pauses", async () => {
    await startSavedProject();
    useAudioStore.getState().setIsPlaying(true);
    useAudioStore.getState().setCurrentTime(30);
    useTimelineStore.getState().setZoom(180);
    useAudioStore.getState().setIsPlaying(false);
    await flushResumePosition();
    expect((await openProjectEntry())?.resumePosition).toEqual({ time: 30, zoom: 180 });
  });

  it("includes the Timeline scroll once the Timeline has scrolled", async () => {
    await startSavedProject();
    useTimelineStore.getState().setScrollLeft(500);
    useTimelineStore.getState().setScrollTop(80);
    await flushResumePosition();
    expect((await openProjectEntry())?.resumePosition?.scroll).toEqual({ left: 500, top: 80 });
  });

  describe("regressions", () => {
    const restoredView = { time: 42, zoom: 220, scroll: { left: 900, top: 60 } };

    function restoreViewNotYetShown(): void {
      useTimelineStore.getState().setZoom(restoredView.zoom);
      useAudioStore.getState().setCurrentTime(restoredView.time);
      useTimelineStore.getState().setPendingResumeView(restoredView);
    }

    it("regression: a pause before the Timeline is shown keeps the saved scroll", async () => {
      await startSavedProject();
      restoreViewNotYetShown();
      useAudioStore.getState().setIsPlaying(true);
      useAudioStore.getState().setIsPlaying(false);
      await flushResumePosition();
      expect((await openProjectEntry())?.resumePosition).toEqual(restoredView);
    });

    it("regression: moving the playhead before the Timeline is shown frames the new playhead instead", async () => {
      await startSavedProject();
      restoreViewNotYetShown();
      useAudioStore.getState().seekTo(70);
      await flushResumePosition();
      expect((await openProjectEntry())?.resumePosition).toEqual({ time: 70, zoom: 220 });
      expect(useTimelineStore.getState().pendingResumeView).toEqual({ time: 70, zoom: 220 });
    });

    it("regression: switching projects during playback saves the position being left", async () => {
      await startSavedProject();
      const leftId = await findOpenProjectId();
      await seedStoredProject("other");
      useAudioStore.getState().setIsPlaying(true);
      useAudioStore.getState().setCurrentTime(33);
      await openProject("other");
      await flushResumePosition();
      if (!leftId) throw new Error("project was not saved");
      expect((await loadProjectIndexEntry(leftId))?.resumePosition?.time).toBe(33);
    });

    it("regression: an open group does not save its fitted zoom", async () => {
      await startSavedProject();
      useTimelineStore.getState().setZoom(150);
      await flushResumePosition();
      useTimelineStore.getState().openGroup("g1", 0);
      useTimelineStore.getState().setZoom(600);
      await flushResumePosition();
      expect((await openProjectEntry())?.resumePosition?.zoom).toBe(150);
    });
  });

  describe("invariants", () => {
    it("does not move the project's last edited time", async () => {
      await startSavedProject();
      const updatedAt = (await openProjectEntry())?.updatedAt;
      useAudioStore.getState().seekTo(12);
      await flushResumePosition();
      const entry = await openProjectEntry();
      expect(entry?.resumePosition?.time).toBe(12);
      expect(entry?.updatedAt).toBe(updatedAt);
    });
  });
});
