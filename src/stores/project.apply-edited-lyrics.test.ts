import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function seedProject() {
  useProjectStore.setState({
    lines: [createLine({ id: "a", text: "Hello", begin: 1, end: 2 })],
    metadata: { title: "Typed title", artists: ["Imported artist"], album: "", duration: 0 },
    importedMetadataKeys: ["artists"],
    hasUnexportedImport: false,
    ttmlEditState: { source: "<tt/>", content: "<tt>edited</tt>" },
  });
}

function apply(
  overrides: Partial<Parameters<ReturnType<typeof useProjectStore.getState>["applyEditedLyricsWithHistory"]>[0]> = {},
) {
  useProjectStore.getState().applyEditedLyricsWithHistory({
    lines: [createLine({ id: "a", text: "Hello there", begin: 1, end: 2 })],
    groups: [],
    agents: DEFAULT_AGENTS,
    metadata: { title: "Typed title", artists: ["Imported artist"] },
    ...overrides,
  });
}

// -- Tests --------------------------------------------------------------------

describe("applyEditedLyricsWithHistory", () => {
  it("writes the edited lines as one undo step", () => {
    seedProject();
    apply();
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Hello there"]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Hello"]);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Hello there"]);
  });

  describe("regressions", () => {
    it("regression: leaves the imported song detail flags alone when the details did not change", () => {
      seedProject();
      apply();
      expect(useProjectStore.getState().importedMetadataKeys).toEqual(["artists"]);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });

    it("regression: never marks typed song details as imported", () => {
      seedProject();
      useProjectStore.setState({ importedMetadataKeys: [] });
      apply({ metadata: { title: "Typed title" } });
      expect(useProjectStore.getState().importedMetadataKeys).toEqual([]);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("takes a changed song detail as the user's own", () => {
      seedProject();
      apply({ metadata: { title: "Typed title", artists: ["Edited artist"] } });
      expect(useProjectStore.getState().metadata.artists).toEqual(["Edited artist"]);
      expect(useProjectStore.getState().importedMetadataKeys).toEqual([]);
    });

    it("keeps a song detail the edit leaves out", () => {
      seedProject();
      apply({ metadata: {} });
      expect(useProjectStore.getState().metadata.title).toBe("Typed title");
    });
  });

  describe("invariants", () => {
    it("writes lines and groups together and leaves the export override to the caller", () => {
      seedProject();
      const group = createGroup({ id: "g1" });
      apply({ groups: [group] });
      expect(useProjectStore.getState().groups).toEqual([group]);
      expect(useProjectStore.getState().ttmlEditState).toEqual({ source: "<tt/>", content: "<tt>edited</tt>" });
      expect(useProjectStore.getState().isDirty).toBe(true);
    });
  });
});
