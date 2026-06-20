/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { type LooseLine, reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgVoice } from "@/domain/line/voices";
import { isLineSynced as isLineSyncedVoice } from "@/domain/voice/predicates";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { placeVoiceAtPlayhead } from "@/views/timeline/place-voice-at-playhead";
import { beforeEach, describe, expect, it } from "vitest";

// -- Constants -----------------------------------------------------------------

const PLAYHEAD = 5;
const DUR = 0.3;

// -- Helpers -------------------------------------------------------------------

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
  useAudioStore.setState({ currentTime: PLAYHEAD });
  useSettingsStore.setState({ defaultWordDuration: DUR });
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

function seed(lines: LooseLine[], groups: LinkGroup[] = []) {
  useProjectStore.setState({
    groups,
    lines: lines.map(reconcileLine),
    isDirtySinceHistory: true,
  });
}

function getLine(id: string) {
  const line = useProjectStore.getState().lines.find((l) => l.id === id);
  if (!line) throw new Error(`line ${id} not found`);
  return line;
}

// -- Tests ---------------------------------------------------------------------

describe("placeVoiceAtPlayhead", () => {
  describe("main", () => {
    it("makes the line main line-synced over [currentTime, currentTime + wordCount*dur]", () => {
      seed([{ id: "L1", text: "hello there world", agentId: "v1" }]);

      placeVoiceAtPlayhead("L1", "main");

      const after = getLine("L1");
      expect(isLineSynced(after)).toBe(true);
      const bounds = mainBounds(after);
      expect(bounds?.begin).toBeCloseTo(PLAYHEAD, 9);
      expect(bounds?.end).toBeCloseTo(PLAYHEAD + 3 * DUR, 9);
    });

    it("reads the live playhead time and word duration at call time", () => {
      seed([{ id: "L1", text: "one two", agentId: "v1" }]);
      useAudioStore.setState({ currentTime: 12 });
      useSettingsStore.setState({ defaultWordDuration: 0.5 });

      placeVoiceAtPlayhead("L1", "main");

      const bounds = mainBounds(getLine("L1"));
      expect(bounds?.begin).toBeCloseTo(12, 9);
      expect(bounds?.end).toBeCloseTo(12 + 2 * 0.5, 9);
    });

    it("does not create a background when none exists", () => {
      seed([{ id: "L1", text: "a b", agentId: "v1" }]);

      placeVoiceAtPlayhead("L1", "main");

      expect(bgVoice(getLine("L1"))).toBeNull();
    });
  });

  describe("background", () => {
    it("makes the bg line-synced over [currentTime, currentTime + wordCount*dur]", () => {
      seed([{ id: "L1", text: "lead", agentId: "v1", backgroundText: "oh oh oh" }]);

      placeVoiceAtPlayhead("L1", "background");

      const after = getLine("L1");
      const bg = bgVoice(after);
      expect(bg).not.toBeNull();
      expect(bg && isLineSyncedVoice(bg)).toBe(true);
      const bounds = bgBounds(after);
      expect(bounds?.begin).toBeCloseTo(PLAYHEAD, 9);
      expect(bounds?.end).toBeCloseTo(PLAYHEAD + 3 * DUR, 9);
    });

    it("leaves the main voice untouched when placing the background", () => {
      seed([{ id: "L1", text: "lead", agentId: "v1", backgroundText: "oh oh" }]);

      placeVoiceAtPlayhead("L1", "background");

      expect(mainBounds(getLine("L1"))).toBeNull();
    });

    it("is a no-op when the line has no background text", () => {
      seed([{ id: "L1", text: "lead vocals", agentId: "v1" }]);
      const before = getLine("L1");

      placeVoiceAtPlayhead("L1", "background");

      expect(getLine("L1")).toBe(before);
      expect(bgVoice(getLine("L1"))).toBeNull();
    });

    it("is a no-op when the background text is empty", () => {
      seed([{ id: "L1", text: "lead", agentId: "v1", backgroundText: "" }]);
      const before = getLine("L1");

      placeVoiceAtPlayhead("L1", "background");

      expect(getLine("L1")).toBe(before);
    });
  });

  describe("per-instance invariant", () => {
    function seedLinkedPair(backgroundText?: string) {
      seed(
        [
          {
            id: "a0",
            text: "Real line",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            ...(backgroundText !== undefined ? { backgroundText, backgroundTextSource: "manual" } : {}),
          },
          {
            id: "a1",
            text: "Real line",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            templateLineIdx: 0,
            ...(backgroundText !== undefined ? { backgroundText, backgroundTextSource: "manual" } : {}),
          },
        ],
        [seedGroup("g1")],
      );
    }

    it("placing main on one instance does not change the linked sibling", () => {
      seedLinkedPair();
      const siblingBefore = getLine("a1");

      placeVoiceAtPlayhead("a0", "main");

      expect(isLineSynced(getLine("a0"))).toBe(true);
      expect(getLine("a1")).toBe(siblingBefore);
      expect(mainBounds(getLine("a1"))).toBeNull();
    });

    it("placing background on one instance does not change the linked sibling", () => {
      seedLinkedPair("ooh ooh");
      const siblingBefore = getLine("a1");

      placeVoiceAtPlayhead("a0", "background");

      const targetBg = bgVoice(getLine("a0"));
      expect(targetBg && isLineSyncedVoice(targetBg)).toBe(true);
      expect(getLine("a1")).toBe(siblingBefore);
      expect(bgBounds(getLine("a1"))).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("is a no-op for a missing lineId", () => {
      seed([{ id: "L1", text: "hello", agentId: "v1" }]);
      const linesBefore = useProjectStore.getState().lines;

      placeVoiceAtPlayhead("nope", "main");

      expect(useProjectStore.getState().lines).toBe(linesBefore);
    });

    it("treats an empty-text line as one word for main placement", () => {
      seed([{ id: "L1", text: "", agentId: "v1" }]);

      placeVoiceAtPlayhead("L1", "main");

      const bounds = mainBounds(getLine("L1"));
      expect(bounds?.begin).toBeCloseTo(PLAYHEAD, 9);
      expect(bounds?.end).toBeCloseTo(PLAYHEAD + DUR, 9);
    });
  });
});
