import { estimateRecordBytes } from "@/domain/project/record-bytes";
import { createAudioFile } from "@/test/audio-fixtures";
import { loadProjectIndexEntry, saveProjectRecord, saveProjectRecordWithAudio } from "@/lib/project-repository";
import { createLine } from "@/test/factories";
import { storedProject } from "@/test/projects";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project repository · storage", () => {
  it("records the size of each saved record in its index entry", async () => {
    const project = storedProject();
    await saveProjectRecord("a", project);
    expect((await loadProjectIndexEntry("a"))?.recordBytes).toBe(estimateRecordBytes(project));
  });

  it("updates the record size when the record grows", async () => {
    await saveProjectRecord("a", storedProject());
    const before = (await loadProjectIndexEntry("a"))?.recordBytes ?? 0;
    const longer = storedProject({ lines: Array.from({ length: 40 }, (_, i) => createLine({ text: `Line ${i}` })) });
    await saveProjectRecord("a", longer);
    expect((await loadProjectIndexEntry("a"))?.recordBytes).toBeGreaterThan(before);
  });

  it("asks the browser to protect storage when the first project is saved, and only then", async () => {
    const persist = vi.spyOn(navigator.storage, "persist");
    await saveProjectRecord("a", storedProject());
    await expect.poll(() => persist.mock.calls.length).toBe(1);
    await saveProjectRecord("a", storedProject());
    await saveProjectRecord("b", storedProject());
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("asks when the first project arrives with its audio", async () => {
    const persist = vi.spyOn(navigator.storage, "persist");
    await saveProjectRecordWithAudio("a", storedProject(), createAudioFile("alpha.wav"));
    await expect.poll(() => persist.mock.calls.length).toBe(1);
  });

  describe("edge cases", () => {
    it("does not ask when a library that already has a project gains another", async () => {
      await saveProjectRecord("a", storedProject());
      const persist = vi.spyOn(navigator.storage, "persist");
      await saveProjectRecordWithAudio("b", storedProject(), undefined);
      expect(persist).not.toHaveBeenCalled();
    });
  });
});
