import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { projectFileFrom, projectFileName } from "@/lib/project-file";
import { readProjectFile, savedProjectFromFile } from "@/lib/project-file-read";
import { describe, expect, it } from "vitest";

describe("persistence: syllableSplitDefaults", () => {
  it("round-trips syllableSplitDefaults through readProjectFile", async () => {
    const metadata = { title: "Song", artists: [], album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      syllableSplitDefaults: { applyToAll: true, caseInsensitive: true },
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.syllableSplitDefaults).toEqual({ applyToAll: true, caseInsensitive: true });
    expect(parsed.version).toBe(3);
  });

  it("fills in defaults when older project file is missing syllableSplitDefaults", async () => {
    const metadata = { title: "Old Song", artists: [], album: "", duration: 0 };
    const legacyPayload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacyPayload)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.syllableSplitDefaults).toEqual({ applyToAll: false, caseInsensitive: false });
  });
});

describe("persistence: primingStripped round-trip", () => {
  it("persists and reads back primingStripped through readProjectFile", async () => {
    const metadata = { title: "Song", artists: [], album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
      primingStripped: true,
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.primingStripped).toBe(true);
  });

  it("leaves primingStripped undefined when importing a pre-strip project", async () => {
    const metadata = { title: "Old", artists: [], album: "", duration: 0 };
    const legacy = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacy)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.primingStripped).toBeUndefined();
  });

  it("preserves primingStripped=false explicitly", async () => {
    const metadata = { title: "Mid", artists: [], album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      primingStripped: false,
    };
    const file = new File([JSON.stringify(payload)], "mid.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.primingStripped).toBe(false);
  });
});

describe("persistence: customSnapPoints round-trip", () => {
  it("readProjectFile preserves customSnapPoints when present", async () => {
    const metadata = { title: "Song", artists: [], album: "", duration: 0 };
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
      customSnapPoints: [5, 12],
    };
    const file = new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.customSnapPoints).toEqual([5, 12]);
  });

  it("leaves customSnapPoints undefined when importing a legacy project without the field", async () => {
    const metadata = { title: "Old", artists: [], album: "", duration: 0 };
    const legacy = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata,
      agents: DEFAULT_AGENTS,
      lines: [],
      groups: [],
      granularity: "word" as const,
    };
    const file = new File([JSON.stringify(legacy)], "legacy.ttml-project.json", { type: "application/json" });

    const parsed = await readProjectFile(file);

    expect(parsed.customSnapPoints).toBeUndefined();
  });
});

describe("persistence: imported song details and hand-edited TTML round-trip", () => {
  const edit = { source: "<tt>generated</tt>", content: "<tt>hand edited</tt>" };
  const project = {
    version: 3 as const,
    savedAt: 1_758_900_000_000,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word" as const,
    importedMetadataKeys: ["title" as const],
    ttmlEditState: edit,
  };

  it("exports and reads back which details an import brought and the TTML edit", async () => {
    const exported = projectFileFrom("p1", project);
    const parsed = await readProjectFile(new File([JSON.stringify(exported)], "song.ttml-project.json"));
    const saved = savedProjectFromFile(parsed, 1);
    expect(saved.importedMetadataKeys).toEqual(["title"]);
    expect(saved.ttmlEditState).toEqual(edit);
  });

  it("leaves both undefined for a file saved before the fields existed", async () => {
    const { importedMetadataKeys: _keys, ttmlEditState: _edit, ...legacy } = project;
    const parsed = await readProjectFile(new File([JSON.stringify(legacy)], "legacy.ttml-project.json"));
    expect(parsed.importedMetadataKeys).toBeUndefined();
    expect(parsed.ttmlEditState).toBeUndefined();
  });
});

describe("projectFileFrom", () => {
  const project = {
    version: 3 as const,
    savedAt: 1_758_900_000_000,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word" as const,
    audioSource: { kind: "youtube" as const, videoId: "dX3k_QDnzHE" },
    currentStem: "vocals" as const,
    primingStripped: true,
    hasUnexportedImport: true,
  };

  it("adds the project id and keeps the audio source", () => {
    const file = projectFileFrom("p1", project);
    expect(file.projectId).toBe("p1");
    expect(file.audioSource).toEqual({ kind: "youtube", videoId: "dX3k_QDnzHE" });
  });

  it("leaves out device-only fields but keeps primingStripped so a re-import never double-shifts LAME priming", () => {
    const file = projectFileFrom("p1", project);
    expect("currentStem" in file).toBe(false);
    expect("hasUnexportedImport" in file).toBe(false);
    expect(file.primingStripped).toBe(true);
  });

  describe("edge cases", () => {
    it("omits projectId when there is no open project id", () => {
      expect("projectId" in projectFileFrom(undefined, project)).toBe(false);
    });
  });
});

describe("readProjectFile with project ids", () => {
  function fileOf(payload: object): File {
    return new File([JSON.stringify(payload)], "song.ttml-project.json", { type: "application/json" });
  }
  const payload = {
    version: 3,
    savedAt: 1,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word",
  };

  it("keeps a string project id", async () => {
    expect((await readProjectFile(fileOf({ ...payload, projectId: "p1" }))).projectId).toBe("p1");
  });

  describe("edge cases", () => {
    it("drops a project id that is not a non-empty string", async () => {
      expect("projectId" in (await readProjectFile(fileOf({ ...payload, projectId: 42 })))).toBe(false);
      expect("projectId" in (await readProjectFile(fileOf({ ...payload, projectId: "" })))).toBe(false);
    });
  });

  describe("error paths", () => {
    it("rejects an unsupported version", async () => {
      await expect(readProjectFile(fileOf({ ...payload, version: 9 }))).rejects.toThrow(/Unsupported project version/);
    });

    it("rejects a file that is not JSON", async () => {
      await expect(readProjectFile(new File(["not json"], "x.json"))).rejects.toThrow();
    });
  });
});

describe("savedProjectFromFile", () => {
  it("drops the project id, stamps the save time and marks the import", () => {
    const saved = savedProjectFromFile(
      {
        version: 1,
        savedAt: 1,
        projectId: "p1",
        metadata: { title: "Song", artists: [], album: "", duration: 0 },
        agents: DEFAULT_AGENTS,
        lines: [],
        granularity: "word",
      },
      500,
    );
    expect("projectId" in saved).toBe(false);
    expect(saved).toMatchObject({ savedAt: 500, version: 3, hasUnexportedImport: true });
  });
});

describe("projectFileName", () => {
  it("names the file after the title and the date", () => {
    expect(projectFileName("Midnight City", new Date("2026-09-27T10:00:00Z"))).toBe(
      "Midnight City-2026-09-27.ttml-project.json",
    );
  });

  describe("edge cases", () => {
    it("falls back to project for an empty title", () => {
      expect(projectFileName("", new Date("2026-09-27T10:00:00Z"))).toBe("project-2026-09-27.ttml-project.json");
    });
  });
});
