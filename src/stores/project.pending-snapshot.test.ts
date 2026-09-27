import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { parseLyricsFile } from "@/utils/lyrics-parsers";

const DUET_TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:title>Duet</ttm:title><ttm:agent type="person" xml:id="v1"><ttm:name type="full">Alice</ttm:name></ttm:agent><ttm:agent type="person" xml:id="v2"><ttm:name type="full">Bob</ttm:name></ttm:agent></metadata></head><body><div><p begin="1.0" end="2.0" ttm:agent="v1">Line one</p><p begin="2.0" end="3.0" ttm:agent="v2">Line two</p></div></body></tt>`;

function importDuet(): void {
  const parsed = parseLyricsFile("duet.ttml", DUET_TTML);
  useProjectStore.getState().replaceLyricsWithHistory({
    lines: parsed.lines,
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: parsed.metadata,
  });
}

function timelineEdit(): void {
  const [first] = useProjectStore.getState().lines;
  useProjectStore.getState().updateLineWithHistory(first.id, { begin: 1.5, end: 2 });
}

const agentNames = () => useProjectStore.getState().agents.map((agent) => agent.name);
const snapTimes = () => useProjectStore.getState().customSnapPoints.map((point) => point.time);

describe("writes outside history leave a pending snapshot", () => {
  describe("regressions", () => {
    it("regression: undo after a song identity reset and a timeline edit keeps the default agent names", () => {
      importDuet();
      useProjectStore.getState().resetSongIdentity("New song");
      timelineEdit();

      useProjectStore.getState().undo();

      expect(agentNames()).toEqual(["Lead", undefined]);
      expect(useProjectStore.getState().lines[0]).toMatchObject({ begin: 1, end: 2 });
    });

    it("regression: undo after restoring a song identity and a timeline edit keeps the restored names", () => {
      importDuet();
      const { metadata, agents, hasUnexportedImport, importedMetadataKeys } = useProjectStore.getState();
      useProjectStore.getState().resetSongIdentity("New song");
      timelineEdit();
      useProjectStore.getState().restoreSongIdentity({ metadata, agents, hasUnexportedImport, importedMetadataKeys });
      timelineEdit();

      useProjectStore.getState().undo();

      expect(agentNames()).toEqual(["Alice", "Bob"]);
    });

    it("regression: undo after clearing snap points and a timeline edit keeps them cleared", () => {
      importDuet();
      useProjectStore.getState().addCustomSnapPoint(4);
      useProjectStore.getState().clearCustomSnapPoints();
      timelineEdit();

      useProjectStore.getState().undo();

      expect(snapTimes()).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("clearing snap points marks the project dirty", () => {
      useProjectStore.getState().addCustomSnapPoint(4);
      useProjectStore.getState().markClean();

      useProjectStore.getState().clearCustomSnapPoints();

      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);
    });

    it("clearing no snap points leaves the project clean", () => {
      useProjectStore.getState().clearCustomSnapPoints();

      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
    });

    it("the song identity writers flag the pending snapshot", () => {
      importDuet();
      useProjectStore.getState().resetSongIdentity("New song");
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);

      timelineEdit();
      const { metadata, agents, hasUnexportedImport, importedMetadataKeys } = useProjectStore.getState();
      useProjectStore.getState().restoreSongIdentity({ metadata, agents, hasUnexportedImport, importedMetadataKeys });
      expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);
    });
  });
});
