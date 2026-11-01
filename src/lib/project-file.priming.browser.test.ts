import { parseLamePriming } from "@/audio/lame-priming";
import { projectFileFrom } from "@/lib/project-file";
import { readProjectFile, savedProjectFromFile } from "@/lib/project-file-read";
import { saveProjectAudio } from "@/lib/project-audio";
import { createProjectId, saveProjectRecord } from "@/lib/project-repository";
import { loadProjectForRestore } from "@/lib/project-restore";
import { createMp3File } from "@/test/audio-fixtures";
import { storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

describe("project file export/import: LAME priming", () => {
  it("regression: re-importing an already-stripped MP3 project does not shift its timings again", async () => {
    const mp3 = createMp3File();
    const { samples, sampleRate } = parseLamePriming(await mp3.arrayBuffer());
    expect(samples).toBeGreaterThan(0);
    expect(sampleRate).toBeGreaterThan(0);

    const original = storedProject();
    expect(original.primingStripped).toBe(true);
    const line = original.lines[0] as { begin: number; end: number };

    const file = projectFileFrom(undefined, original);
    const reimported = await readProjectFile(
      new File([JSON.stringify(file)], "song.ttml-project.json", { type: "application/json" }),
    );
    const saved = savedProjectFromFile(reimported, Date.now());

    const id = createProjectId();
    await saveProjectAudio(id, mp3);
    await saveProjectRecord(id, saved);

    const restored = await loadProjectForRestore(id);
    const restoredLine = restored.project?.lines[0] as { begin: number; end: number };
    expect(restoredLine.begin).toBe(line.begin);
    expect(restoredLine.end).toBe(line.end);
    expect(restored.project?.primingStripped).toBe(true);
  });
});
