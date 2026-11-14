import { msFromSeconds } from "insync/time";
import { beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { addGroup } from "@/domain/commands/group-edits";
import { bgBounds } from "@/domain/line/bounds";
import { lineText } from "@/domain/line/text";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { withOffset } from "@/domain/tempo/grid-edits";
import { applySavedProject } from "@/lib/apply-saved-project";
import { buildSavedProject } from "@/lib/persistence";
import { buildSaveInput, currentSaveInput } from "@/lib/project-snapshot";
import type { SavedLine, SavedProject } from "@/lib/saved-project";
import { SAVED_PROJECT_VERSION, savedLines } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createProjectSaveInput } from "@/test/factories";
import { resetAllStores } from "@/test/stores";

const FILE_AGENTS: Agent[] = [
  { id: "v1", type: "person", name: "File Lead" },
  { id: "v2", type: "person", name: "File Duet" },
];

function projectFile(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    ...buildSavedProject(
      createProjectSaveInput({
        agents: FILE_AGENTS,
        lines: [createLine({ id: "b1", text: "file line", groupId: "gb", instanceIdx: 0, templateLineIdx: 0 })],
        groups: [createGroup({ id: "gb", label: "File group" })],
      }),
    ),
    savedAt: 0,
    ...overrides,
  };
}

function editProjectA(): void {
  const store = useProjectStore.getState();
  store.commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "a1", text: "first" })]));
  useProjectStore.getState().commit(addGroup(createGroup({ id: "ga", label: "Old group" })));
  useProjectStore
    .getState()
    .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "a1", text: "second" })]));
}

describe("applySavedProject", () => {
  beforeEach(resetAllStores);

  describe("regressions", () => {
    it("regression: undo after opening a project file keeps the file's lines, groups and agents", () => {
      editProjectA();

      applySavedProject(projectFile(), "file");
      useProjectStore.getState().undo();

      const state = useProjectStore.getState();
      expect(state.lines.map((line) => line.id)).toEqual(["b1"]);
      expect(state.groups.map((group) => group.id)).toEqual(["gb"]);
      expect(state.agents.map((agent) => agent.name)).toEqual(["File Lead", "File Duet"]);
    });

    it("regression: a project file starts with nothing to undo", () => {
      editProjectA();

      applySavedProject(projectFile(), "file");

      const state = useProjectStore.getState();
      expect(state.canUndo()).toBe(false);
      expect(state.canRedo()).toBe(false);
      expect(state.history).toEqual([]);
      expect(state.historyIndex).toBe(-1);
      expect(state.isDirtySinceHistory).toBe(false);
    });

    it("regression: stores timing for background vocals saved on a synced line without words", () => {
      const legacy = createLine({ id: "l1", text: "hello", begin: 10, end: 14, backgroundText: "ooh" });

      for (const origin of ["storage", "file"] as const) {
        applySavedProject(projectFile({ lines: savedLines([legacy]) }), origin);

        const state = useProjectStore.getState();
        expect(bgBounds(state.lines[0])).toEqual({ begin: 12, end: 14 });
        expect(state.isDirty).toBe(false);
      }
    });

    it("regression: a line-synced background keeps its own span when a format 4 record opens", () => {
      const lines: SavedLine[] = [
        {
          id: "l1",
          tracks: [
            {
              role: "main",
              agent: "v1",
              span: [msFromSeconds(10), msFromSeconds(20)],
              syllables: [{ text: "hello", sep: "" }],
            },
            { role: "bg", span: [msFromSeconds(12), msFromSeconds(14)], syllables: [{ text: "ooh", sep: "" }] },
          ],
        },
      ];

      applySavedProject(projectFile({ lines }), "storage");

      expect(bgBounds(useProjectStore.getState().lines[0])).toEqual({ begin: 12, end: 14 });
    });

    it("regression: drops imported metadata keys a hand-edited file does not know", () => {
      const keys = JSON.parse('["isrc", "producer"]');

      applySavedProject(projectFile({ importedMetadataKeys: keys }), "file");

      expect(useProjectStore.getState().importedMetadataKeys).toEqual(["isrc"]);
    });
  });

  describe("invariants", () => {
    it("an edit after opening a file undoes back to the file, not past it", () => {
      editProjectA();
      applySavedProject(projectFile(), "file");

      useProjectStore
        .getState()
        .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "b1", text: "edited" })]));
      useProjectStore.getState().undo();
      useProjectStore.getState().undo();

      expect(useProjectStore.getState().lines.map((line) => lineText(line))).toEqual(["file line"]);
      expect(useProjectStore.getState().groups.map((group) => group.id)).toEqual(["gb"]);
    });
  });

  describe("export timing", () => {
    it("restores a line export timing from storage and from a file", () => {
      applySavedProject(projectFile({ exportTiming: "line" }), "storage");
      expect(useProjectStore.getState().exportTiming).toBe("line");

      resetAllStores();
      applySavedProject(projectFile({ exportTiming: "line" }), "file");
      expect(useProjectStore.getState().exportTiming).toBe("line");
    });

    it("defaults to word when the saved project has no export timing", () => {
      useProjectStore.getState().setExportTiming("line");

      applySavedProject(projectFile({ exportTiming: undefined }), "storage");

      expect(useProjectStore.getState().exportTiming).toBe("word");
    });

    it("saves the export timing with the project", () => {
      applySavedProject(projectFile(), "storage");
      useProjectStore.getState().setExportTiming("line");

      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(buildSaveInput()?.exportTiming).toBe("line");
    });
  });

  describe("beat grid", () => {
    const beats = [0.5, 1, 1.5, 2, 2.5];
    const grid = withOffset(detectedGrid({ beats, downbeats: [0.5, 2.5] }), 20);

    it("round-trips through save and restore", async () => {
      useProjectStore
        .getState()
        .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "a1", text: "line" })]));
      useProjectStore.getState().applyBeatGridWithHistory(grid);
      const saved = buildSaveInput();
      if (!saved) throw new Error("expected a save input");
      await resetAllStores();

      applySavedProject(
        JSON.parse(
          JSON.stringify({ version: SAVED_PROJECT_VERSION, savedAt: 0, ...saved, lines: savedLines(saved.lines) }),
        ),
        "storage",
      );

      expect(useProjectStore.getState().beatGrid).toEqual(grid);
    });

    it("opens a project with a malformed grid without one", () => {
      applySavedProject(projectFile({ beatGrid: { ...grid, beats: [2, 1] } }), "file");

      expect(useProjectStore.getState().beatGrid).toBeNull();
      expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["b1"]);
    });

    it("opens an older project with no grid", () => {
      applySavedProject(projectFile(), "file");

      expect(useProjectStore.getState().beatGrid).toBeNull();
    });
  });
});

describe("unison link", () => {
  beforeEach(resetAllStores);

  it("round-trips through save and restore", async () => {
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "a1", text: "line" })]));
    useProjectStore.getState().linkUnisonLyric("4821");
    expect(useProjectStore.getState().isDirty).toBe(true);
    const saved = buildSaveInput();
    if (!saved) throw new Error("expected a save input");
    await resetAllStores();

    applySavedProject(JSON.parse(JSON.stringify(buildSavedProject(saved))), "storage");

    expect(useProjectStore.getState().unisonLyricId).toBe("4821");
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it("opens an older project with no link unlinked", () => {
    useProjectStore.getState().linkUnisonLyric("4821");
    applySavedProject(projectFile(), "storage");
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
  });

  it("reads a malformed id as no link", () => {
    for (const junk of ["12a", "", " 12", 42]) {
      applySavedProject(JSON.parse(JSON.stringify({ ...projectFile(), unisonLyricId: junk })), "file");
      expect(useProjectStore.getState().unisonLyricId).toBeNull();
    }
  });
});

describe("primingCorrected", () => {
  it("a project made by this build saves it true", () => {
    useProjectStore.getState().reset();
    expect(currentSaveInput().primingCorrected).toBe(true);
  });

  it("a stored project saved before the fix restores it false", () => {
    applySavedProject(projectFile({ primingCorrected: undefined }), "storage");
    expect(useProjectStore.getState().primingCorrected).toBe(false);
  });
});

describe("unknown TTML data", () => {
  beforeEach(resetAllStores);

  it("a v4 save and load keeps passthrough and parts", () => {
    const lines: SavedLine[] = [
      {
        id: "L1",
        passthrough: { attrs: [["x-vendor:mood", "calm"]] },
        tracks: [
          {
            id: "L1:main",
            role: "main",
            agent: "v1",
            syllables: [
              {
                id: "w1",
                text: "Harbour",
                sep: " ",
                span: [msFromSeconds(1), msFromSeconds(1.5)],
                passthrough: { attrs: [["x-vendor:cue", "3"]] },
              },
              { id: "w2", text: "lights", sep: "", span: [msFromSeconds(1.5), msFromSeconds(2)] },
            ],
          },
          {
            id: "L1:bg",
            role: "bg",
            passthrough: { attrs: [["x-vendor:layer", "2"]] },
            syllables: [{ id: "w3", text: "glow", sep: "", span: [msFromSeconds(2), msFromSeconds(2.4)] }],
          },
        ],
      },
    ];
    const kept = {
      agents: [{ ...FILE_AGENTS[0], passthrough: { attrs: [["x-vendor:voice", "alto"]] } }, FILE_AGENTS[1]],
      lines,
      parts: [{ id: "p1", kind: "Verse", lineIds: ["L1"] }],
      passthrough: { tt: { attrs: [["xmlns:x-vendor", "urn:x"]] } },
    } satisfies Partial<SavedProject>;

    applySavedProject(structuredClone(projectFile(kept)), "storage");
    const resaved = buildSavedProject(currentSaveInput());

    expect(resaved).toMatchObject(kept);
  });

  it("a project without kept data saves no field for it", () => {
    const saved = buildSavedProject(createProjectSaveInput());
    expect(saved).not.toHaveProperty("parts");
    expect(saved).not.toHaveProperty("passthrough");
  });
});
