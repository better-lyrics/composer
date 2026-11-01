import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { openProjectForVideo } from "@/lib/open-video-project";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

async function openAlpha(lyrics: boolean): Promise<void> {
  await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), ...(lyrics ? {} : { lines: [] }) } });
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("openProjectForVideo", () => {
  it("opens a new project when the open one has lyrics and no project has the video", async () => {
    await openAlpha(true);
    const outcome = await openProjectForVideo(VIDEO_ID);
    expect(outcome).toEqual({ kind: "created", id: openProjectIdSnapshot(), previousId: "a", previousTitle: "Alpha" });
    expect(useProjectStore.getState().metadata.title).toBe(VIDEO_ID);
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  it("reopens the project that already has the video", async () => {
    await openAlpha(true);
    await seedStoredProject("b", {
      project: { ...songTitled("Bravo"), audioSource: { kind: "youtube", videoId: VIDEO_ID } },
    });
    expect(await openProjectForVideo(VIDEO_ID)).toEqual({ kind: "reopened", id: "b" });
    expect(openProjectIdSnapshot()).toBe("b");
  });

  describe("edge cases", () => {
    it("reuses an open project without lyrics", async () => {
      await openAlpha(false);
      expect(await openProjectForVideo(VIDEO_ID)).toEqual({ kind: "current" });
      expect(openProjectIdSnapshot()).toBe("a");
    });

    it("the open project's own video reopens it", async () => {
      await openAlpha(true);
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      expect(await openProjectForVideo(VIDEO_ID)).toEqual({ kind: "reopened", id: "a" });
    });
  });

  describe("regressions", () => {
    it("regression: lyrics typed before the first save still move to a new project instead of being replaced", async () => {
      useProjectStore.getState().setLines([createLine({ text: "Waiting in a car" })]);
      useProjectStore.getState().setMetadata({ title: "Alpha" });
      const outcome = await openProjectForVideo(VIDEO_ID);
      if (outcome.kind !== "created") throw new Error(`expected a new project, got ${outcome.kind}`);
      expect(outcome.previousId).not.toBe(outcome.id);
      expect(outcome.previousTitle).toBe("Alpha");
      expect(openProjectIdSnapshot()).toBe(outcome.id);
    });
  });
});
