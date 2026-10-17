import { forkOpenProject, restoreOpenProject } from "@/lib/open-project";
import { loadProjectAudio } from "@/lib/project-audio";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

describe("forkOpenProject · Keep YouTube audio", () => {
  it("does not copy YouTube audio the rule says not to keep", async () => {
    useSettingsStore.setState({ keepYouTubeAudio: "never" });
    await seedStoredProject("a", {
      open: true,
      project: { ...songTitled("Alpha"), audioSource: { kind: "youtube", videoId: "v1" } },
    });
    await restoreOpenProject();
    useAudioStore.getState().setYouTubeFile(createAudioFile("v1.opus"));
    const keptId = await forkOpenProject();
    expect(await loadProjectAudio(keptId)).toBeUndefined();
  });

  it("copies it when the rule keeps it", async () => {
    useSettingsStore.setState({ keepYouTubeAudio: "always" });
    await seedStoredProject("a", {
      open: true,
      project: { ...songTitled("Alpha"), audioSource: { kind: "youtube", videoId: "v1" } },
    });
    await restoreOpenProject();
    useAudioStore.getState().setYouTubeFile(createAudioFile("v1.opus"));
    const keptId = await forkOpenProject();
    expect((await loadProjectAudio(keptId))?.name).toBe("v1.opus");
  });
});
