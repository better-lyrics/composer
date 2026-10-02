import type { ProjectFile } from "@/lib/project-file";
import { findImportConflict, projectFileSummary } from "@/lib/project-import";
import { createLine } from "@/test/factories";
import { indexEntry as entry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function file(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    version: 3,
    savedAt: 100,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: [],
    lines: [],
    granularity: "word",
    ...overrides,
  };
}

// -- Tests --------------------------------------------------------------------

describe("findImportConflict", () => {
  it("matches the same project id first", () => {
    const entries = [entry("a"), entry("b", { videoId: "vid" })];
    const conflict = findImportConflict(
      file({ projectId: "a", audioSource: { kind: "youtube", videoId: "vid" } }),
      entries,
    );
    expect(conflict).toMatchObject({ reason: "same-project", existing: { id: "a" } });
  });

  it("falls back to the most recently edited project with the same video", () => {
    const entries = [entry("old", { videoId: "vid", updatedAt: 1 }), entry("new", { videoId: "vid", updatedAt: 9 })];
    const conflict = findImportConflict(file({ audioSource: { kind: "youtube", videoId: "vid" } }), entries);
    expect(conflict).toMatchObject({ reason: "same-video", existing: { id: "new" } });
  });

  describe("edge cases", () => {
    it("finds nothing for an old file without a project id or a video", () => {
      expect(findImportConflict(file(), [entry("a")])).toBeUndefined();
    });

    it("finds nothing when the project id is gone and the audio is a file", () => {
      const conflict = findImportConflict(
        file({ projectId: "deleted", audioSource: { kind: "file", name: "a.wav" } }),
        [entry("a")],
      );
      expect(conflict).toBeUndefined();
    });
  });
});

describe("projectFileSummary", () => {
  it("counts lyric lines and synced lines with the domain predicates", () => {
    const summary = projectFileSummary(
      file({
        lines: [createLine({ text: "a", begin: 1, end: 2 }), createLine({ text: "b" }), createLine({ text: "" })],
      }),
    );
    expect(summary).toEqual({ savedAt: 100, lineCount: 2, syncedLineCount: 1 });
  });
});
