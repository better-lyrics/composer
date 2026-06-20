import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { setBackground } from "@/domain/line/background";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

function lineSyncedMain(id: string) {
  return reconcileLine({ id, text: "one two three", agentId: "v1", begin: 1, end: 4 });
}

function lineSyncedBg(id: string) {
  const main = reconcileLine({ id, text: "lead", agentId: "v1", words: [{ text: "lead", begin: 0, end: 2 }] });
  return setBackground(main, { text: "ooh ooh", begin: 3, end: 5, source: "manual" });
}

function wordSyncedMain(id: string) {
  return reconcileLine({ id, text: "done", agentId: "v1", words: [{ text: "done", begin: 0, end: 1 }] });
}

function setLineAndTarget(rawLine: ReturnType<typeof reconcileLine>, type: "word" | "bg") {
  useProjectStore.setState({ lines: [rawLine] });
  const effective = getEffectiveLines([rawLine]);
  const lineIndex = effective.findIndex((l) => l.id === rawLine.id);
  useTimelineStore.setState({
    contextMenu: { x: 0, y: 0, target: { kind: "word", lineId: rawLine.id, lineIndex, wordIndex: 0, type } },
    selectedWords: [],
  });
}

function setGutterTarget(rawLine: ReturnType<typeof reconcileLine>) {
  useProjectStore.setState({ lines: [rawLine] });
  useTimelineStore.setState({
    contextMenu: { x: 0, y: 0, target: { kind: "gutter", lineId: rawLine.id, lineIndex: 0 } },
    selectedWords: [],
  });
}

// -- Tests --------------------------------------------------------------------

describe("useContextMenuTargets · splitIntoWordsInfo voice", () => {
  it("reports voice main for a line-synced main block target", async () => {
    setLineAndTarget(lineSyncedMain("L1"), "word");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toEqual({ count: 1, voice: "main" });
  });

  it("reports voice bg for a line-synced bg block target", async () => {
    setLineAndTarget(lineSyncedBg("B1"), "bg");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toEqual({ count: 1, voice: "bg" });
  });

  it("returns null for a word-synced main block target", async () => {
    setLineAndTarget(wordSyncedMain("W1"), "word");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toBeNull();
  });

  it("returns null for a word-synced bg block target", async () => {
    const main = reconcileLine({ id: "WB", text: "lead", agentId: "v1", begin: 0, end: 1 });
    const withWordBg = setBackground(main, {
      text: "(echo)",
      words: [{ text: "(echo)", begin: 2, end: 3 }],
      source: "manual",
    });
    setLineAndTarget(withWordBg, "bg");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toBeNull();
  });

  it("ignores a line-synced main when the target block is bg with no background", async () => {
    setLineAndTarget(lineSyncedMain("L1"), "bg");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toBeNull();
  });

  it("counts only same-type selected lines for a bg target", async () => {
    const b1 = lineSyncedBg("B1");
    const b2 = lineSyncedBg("B2");
    useProjectStore.setState({ lines: [b1, b2] });
    useTimelineStore.setState({
      contextMenu: { x: 0, y: 0, target: { kind: "word", lineId: "B1", lineIndex: 0, wordIndex: 0, type: "bg" } },
      // A main selection on B1 plus bg selections on B1 and B2: only the bg ones count.
      selectedWords: [
        { lineId: "B1", lineIndex: 0, wordIndex: 0, type: "word" },
        { lineId: "B1", lineIndex: 0, wordIndex: 0, type: "bg" },
        { lineId: "B2", lineIndex: 1, wordIndex: 0, type: "bg" },
      ],
    });
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.splitIntoWordsInfo).toEqual({ count: 2, voice: "bg" });
  });
});

describe("useContextMenuTargets · gutterBackgroundInfo", () => {
  it("is non-null for a gutter target on a line with an untimed bg", async () => {
    setGutterTarget(reconcileLine({ id: "G1", text: "verse", agentId: "v1", backgroundText: "ooh" }));
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.gutterBackgroundInfo).toEqual({ lineId: "G1" });
  });

  it("is non-null for a gutter target on a line with a line-synced bg", async () => {
    setGutterTarget(lineSyncedBg("G2"));
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.gutterBackgroundInfo).toEqual({ lineId: "G2" });
  });

  it("is null for a gutter target on a line with no bg", async () => {
    setGutterTarget(reconcileLine({ id: "G3", text: "verse", agentId: "v1" }));
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.gutterBackgroundInfo).toBeNull();
  });

  it("is null for a non-gutter (word) target even when the line has a bg", async () => {
    setLineAndTarget(lineSyncedBg("G4"), "bg");
    const { result } = await renderHook(() => useContextMenuTargets());
    expect(result.current.gutterBackgroundInfo).toBeNull();
  });
});
