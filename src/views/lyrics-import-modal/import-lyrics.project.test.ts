import type { Agent } from "@/domain/agent/model";
import type { ProjectFile } from "@/lib/project-file";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import {
  type ImportContext,
  type ImportSourceInfo,
  importProjectLyrics,
} from "@/views/lyrics-import-modal/import-lyrics";
import { beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const SINGERS: Agent[] = [
  { id: "v1", type: "person", name: "Abel" },
  { id: "v2", type: "person", name: "Lana" },
];

const CHORUS = createGroup({ id: "chorus", label: "Chorus" });

function projectFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: 1_759_300_000_000,
    metadata: {
      title: "Lust for Life",
      artists: ["Lana Del Rey", "The Weeknd"],
      album: "Lust for Life",
      duration: 264,
    },
    agents: SINGERS,
    lines: [
      createLine({ id: "f1", text: "Climb up the H of the Hollywood sign", agentId: "v2", begin: 12, end: 15 }),
      createLine({ id: "f2", text: "In these stolen moments", agentId: "v1", groupId: "chorus", instanceIdx: 0 }),
    ],
    groups: [CHORUS],
    granularity: "word",
    audioSource: { kind: "file", name: "lust-for-life.opus" },
    ...overrides,
  };
}

function recordingContext(): { ctx: ImportContext; results: { parsed: ParseResult; source: ImportSourceInfo }[] } {
  const results: { parsed: ParseResult; source: ImportSourceInfo }[] = [];
  return {
    results,
    ctx: {
      confirm: async () => {
        throw new Error("a project file import must not ask to confirm a replace");
      },
      audioDuration: 0,
      applyBackgroundExtraction: true,
      backgroundExtractionMergeStandalone: false,
      backgroundExtractionPreserveBrackets: false,
      sourceLabel: "File",
      onResult: (parsed, source) => results.push({ parsed, source }),
    },
  };
}

beforeEach(() => {
  useProjectStore.setState({
    lines: [createLine({ id: "old", text: "Old line" })],
    metadata: { title: "Untitled draft", artists: [], album: "", duration: 0 },
    isDirtySinceHistory: true,
  });
});

// -- Tests --------------------------------------------------------------------

describe("importProjectLyrics", () => {
  it("replaces the lyrics, groups, singers and song details with the project file's", () => {
    const { ctx } = recordingContext();
    expect(importProjectLyrics(projectFile(), "lust.ttml-project.json", ctx)).toBe(true);
    const state = useProjectStore.getState();
    expect(state.lines.map((line) => line.text)).toEqual([
      "Climb up the H of the Hollywood sign",
      "In these stolen moments",
    ]);
    expect(state.groups.map((group) => group.id)).toEqual(["chorus"]);
    expect(state.agents.map((agent) => agent.name)).toEqual(["Abel", "Lana"]);
    expect(state.metadata.title).toBe("Lust for Life");
    expect(state.metadata.artists).toEqual(["Lana Del Rey", "The Weeknd"]);
  });

  it("records the result for the import banner under the file name", () => {
    const { ctx, results } = recordingContext();
    importProjectLyrics(projectFile(), "lust.ttml-project.json", ctx);
    expect(results).toHaveLength(1);
    expect(results[0].source).toEqual({ label: "File", filename: "lust.ttml-project.json" });
    expect(results[0].parsed.lines).toHaveLength(2);
    expect(results[0].parsed.hasTimingData).toBe(true);
    expect(results[0].parsed.issues).toEqual([]);
  });

  it("is one undo step back to the previous lyrics", () => {
    const { ctx } = recordingContext();
    importProjectLyrics(projectFile(), "lust.ttml-project.json", ctx);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Old line"]);
  });

  describe("invariants", () => {
    it("leaves the loaded audio alone", () => {
      const audio = new File([], "current-song.opus", { type: "audio/ogg" });
      useAudioStore.setState({ source: { type: "file", file: audio } });
      const { ctx } = recordingContext();
      importProjectLyrics(projectFile(), "lust.ttml-project.json", ctx);
      expect(useAudioStore.getState().source).toEqual({ type: "file", file: audio });
    });

    it("keeps this song's artwork, video id and duration, since they belong to the loaded audio", () => {
      useProjectStore.setState({
        metadata: {
          title: "Mine",
          artists: [],
          album: "",
          duration: 200,
          thumbnailDataUrl: "data:mine",
          thumbnailForVideoId: "MINE",
        },
      });
      const { ctx } = recordingContext();
      const file = projectFile({
        metadata: {
          title: "Lust for Life",
          artists: ["Lana Del Rey"],
          album: "",
          duration: 99,
          thumbnailDataUrl: "data:other",
          thumbnailForVideoId: "OTHER",
        },
      });
      importProjectLyrics(file, "lust.json", ctx);
      const { metadata, importedMetadataKeys } = useProjectStore.getState();
      expect([metadata.thumbnailDataUrl, metadata.thumbnailForVideoId, metadata.duration]).toEqual([
        "data:mine",
        "MINE",
        200,
      ]);
      expect(importedMetadataKeys).not.toContain("thumbnailDataUrl");
      expect(importedMetadataKeys).not.toContain("duration");
    });

    it("keeps the file's timing and text exactly, with no background extraction or timing spread", () => {
      const { ctx } = recordingContext();
      const file = projectFile({ lines: [createLine({ id: "p", text: "Hello (ooh)" })] });
      importProjectLyrics(file, "song.json", { ...ctx, audioDuration: 200 });
      const [line] = useProjectStore.getState().lines;
      expect(line.text).toBe("Hello (ooh)");
      expect(line.begin).toBeUndefined();
    });

    it("does not mutate the project file it reads", () => {
      const { ctx } = recordingContext();
      const file = projectFile();
      const snapshot = structuredClone(file);
      importProjectLyrics(file, "song.json", ctx);
      expect(file).toEqual(snapshot);
    });
  });

  describe("regressions", () => {
    it("regression: reports only the song details it applied, not the audio-bound ones", () => {
      const { ctx, results } = recordingContext();
      importProjectLyrics(
        projectFile({ metadata: { ...projectFile().metadata, thumbnailDataUrl: "data:other" } }),
        "lust.ttml-project.json",
        ctx,
      );
      expect(results[0].parsed.metadata).not.toHaveProperty("duration");
      expect(results[0].parsed.metadata).not.toHaveProperty("thumbnailDataUrl");
      expect(results[0].parsed.metadata.title).toBe("Lust for Life");
    });

    it("regression: audio-bound details alone are not an unexported import", () => {
      const { ctx } = recordingContext();
      useProjectStore.setState({ hasUnexportedImport: false });
      importProjectLyrics(
        projectFile({ metadata: { title: "", artists: [], album: "", duration: 264 }, agents: [] }),
        "lust.ttml-project.json",
        ctx,
      );
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("refuses a project file with no lyric lines and leaves the project untouched", () => {
      const { ctx, results } = recordingContext();
      const file = projectFile({ lines: [createLine({ id: "blank", text: "" })] });
      expect(importProjectLyrics(file, "empty.json", ctx)).toBe(false);
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Old line"]);
      expect(results).toEqual([]);
    });

    it("treats a file without groups as having none", () => {
      const { ctx } = recordingContext();
      const file = projectFile({ groups: undefined, lines: [createLine({ id: "solo", text: "Solo line" })] });
      importProjectLyrics(file, "song.json", ctx);
      expect(useProjectStore.getState().groups).toEqual([]);
    });

    it("reports untimed lyrics as having no timing", () => {
      const { ctx, results } = recordingContext();
      importProjectLyrics(projectFile({ lines: [createLine({ id: "u", text: "Untimed" })] }), "song.json", ctx);
      expect(results[0].parsed.hasTimingData).toBe(false);
    });
  });
});
