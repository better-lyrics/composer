import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { projectFileFrom } from "@/lib/project-file";
import { readProjectFile } from "@/lib/project-file-read";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { describe, expect, it } from "vitest";

describe("readProjectFile version support", () => {
  function fileOf(version: number): File {
    return new File(
      [
        JSON.stringify({
          version,
          savedAt: 1,
          metadata: { title: "Song", artists: [], album: "", duration: 0 },
          agents: DEFAULT_AGENTS,
          lines: [],
          granularity: "word",
        }),
      ],
      "song.ttml-project.json",
      { type: "application/json" },
    );
  }

  it("accepts the current version and every version before it", async () => {
    for (let version = 1; version <= SAVED_PROJECT_VERSION; version++) {
      await expect(readProjectFile(fileOf(version))).resolves.toBeDefined();
    }
  });

  describe("error paths", () => {
    it("rejects a version newer than the current one", async () => {
      await expect(readProjectFile(fileOf(SAVED_PROJECT_VERSION + 1))).rejects.toThrow(/Unsupported project version/);
    });
  });
});

describe("readProjectFile malformed payloads", () => {
  const validPayload = {
    version: SAVED_PROJECT_VERSION,
    savedAt: 1,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word",
  };

  function fileOf(body: unknown): File {
    return new File([JSON.stringify(body)], "song.ttml-project.json", { type: "application/json" });
  }

  describe("error paths", () => {
    it("rejects null with a clear message instead of a destructuring error", async () => {
      await expect(readProjectFile(fileOf(null))).rejects.toThrow(/Not a Composer project file/);
    });

    it("rejects an array", async () => {
      await expect(readProjectFile(fileOf([1, 2, 3]))).rejects.toThrow(/Not a Composer project file/);
    });

    it("rejects a bare number", async () => {
      await expect(readProjectFile(fileOf(42))).rejects.toThrow(/Not a Composer project file/);
    });

    it("rejects an object missing lines", async () => {
      const { lines: _lines, ...withoutLines } = validPayload;
      await expect(readProjectFile(fileOf(withoutLines))).rejects.toThrow(/Not a Composer project file/);
    });

    it("rejects an object missing metadata", async () => {
      const { metadata: _metadata, ...withoutMetadata } = validPayload;
      await expect(readProjectFile(fileOf(withoutMetadata))).rejects.toThrow(/Not a Composer project file/);
    });
  });
});

describe("projectFileFrom / readProjectFile round trip", () => {
  it("keeps projectId, audioSource and primingStripped through export then import", async () => {
    const project = {
      version: 3 as const,
      savedAt: 1,
      metadata: { title: "Song", artists: [], album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [],
      granularity: "word" as const,
      audioSource: { kind: "youtube" as const, videoId: "dX3k_QDnzHE" },
      primingStripped: true,
    };
    const file = new File([JSON.stringify(projectFileFrom("p1", project))], "song.ttml-project.json", {
      type: "application/json",
    });

    const roundTripped = await readProjectFile(file);

    expect(roundTripped.projectId).toBe("p1");
    expect(roundTripped.audioSource).toEqual({ kind: "youtube", videoId: "dX3k_QDnzHE" });
    expect(roundTripped.primingStripped).toBe(true);
  });
});
