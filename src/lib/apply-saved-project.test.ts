import type { Agent } from "@/domain/agent/model";
import { applySavedProject } from "@/lib/apply-saved-project";
import { buildSaveInput } from "@/lib/project-snapshot";
import type { SavedProject } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createProjectSaveInput } from "@/test/factories";
import { resetAllStores } from "@/test/stores";
import { beforeEach, describe, expect, it } from "vitest";

const FILE_AGENTS: Agent[] = [
  { id: "v1", type: "person", name: "File Lead" },
  { id: "v2", type: "person", name: "File Duet" },
];

function projectFile(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    version: 3,
    savedAt: 0,
    ...createProjectSaveInput({
      agents: FILE_AGENTS,
      lines: [createLine({ id: "b1", text: "file line", groupId: "gb", instanceIdx: 0, templateLineIdx: 0 })],
      groups: [createGroup({ id: "gb", label: "File group" })],
    }),
    ...overrides,
  };
}

function editProjectA(): void {
  const store = useProjectStore.getState();
  store.setLinesWithHistory([createLine({ id: "a1", text: "first" })]);
  useProjectStore.getState().addGroup(createGroup({ id: "ga", label: "Old group" }));
  useProjectStore.getState().setLinesWithHistory([createLine({ id: "a1", text: "second" })]);
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

      useProjectStore.getState().setLinesWithHistory([createLine({ id: "b1", text: "edited" })]);
      useProjectStore.getState().undo();
      useProjectStore.getState().undo();

      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["file line"]);
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
});
