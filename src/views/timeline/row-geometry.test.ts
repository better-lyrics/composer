import { describe, expect, it } from "vitest";
import { setBackground } from "@/domain/line/background";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { BG_DROP_ZONE_HEIGHT, ROW_BORDER, bgTrackHeightOf, rowHeightOf } from "@/views/timeline/row-geometry";
import { computeRowLayout } from "@/views/timeline/utils";

// -- Fixtures -----------------------------------------------------------------

const wordSynced = (id: string): LyricLine =>
  reconcileLine({
    id,
    agentId: "a",
    text: "hi there",
    words: [
      { text: "hi ", begin: 0, end: 0.5 },
      { text: "there", begin: 0.5, end: 1 },
    ],
  });

// word-synced main + LINE-SYNCED background: the case the raw-bgWords formula got
// wrong (no raw bg word array, so it sized the row at the 24px drop zone while the
// renderer sized it at a full track).
const lineSyncedBg = (id: string): LyricLine =>
  setBackground(wordSynced(id), { text: "ooh", begin: 0, end: 1, source: "manual" });

const wordSyncedBg = (id: string): LyricLine =>
  setBackground(wordSynced(id), { text: "ooh", words: [{ text: "ooh", begin: 0, end: 1 }], source: "manual" });

const MAIN = 44;
const WAVEFORM = 80;
const HEADER = 20;

const layoutOf = (lines: LyricLine[]) =>
  computeRowLayout({
    lines,
    rowHeights: {},
    defaultRowHeight: MAIN,
    collapsedInstances: {},
    waveformHeight: WAVEFORM,
    groupHeaderHeight: HEADER,
  });

// -- Tests --------------------------------------------------------------------

describe("bgTrackHeightOf", () => {
  it("returns the full main height for a line-synced background (effective)", () => {
    const [effective] = getEffectiveLines([lineSyncedBg("l")]);
    expect(bgTrackHeightOf(effective, MAIN)).toBe(MAIN);
  });

  it("returns the full main height for a word-synced background", () => {
    expect(bgTrackHeightOf(wordSyncedBg("l"), MAIN)).toBe(MAIN);
  });

  it("returns the thin drop zone when there is no background", () => {
    expect(bgTrackHeightOf(wordSynced("l"), MAIN)).toBe(BG_DROP_ZONE_HEIGHT);
  });
});

describe("rowHeightOf", () => {
  it("sizes a background row at two full tracks plus the border", () => {
    const [effective] = getEffectiveLines([lineSyncedBg("l")]);
    expect(rowHeightOf(effective, MAIN)).toBe(MAIN + MAIN + ROW_BORDER);
  });

  it("sizes a bare row at one track plus the drop zone plus the border", () => {
    expect(rowHeightOf(wordSynced("l"), MAIN)).toBe(MAIN + BG_DROP_ZONE_HEIGHT + ROW_BORDER);
  });
});

describe("computeRowLayout regression: line-synced background", () => {
  it("gives a line-synced-background row a full track, not the 24px drop zone", () => {
    const layout = layoutOf([lineSyncedBg("l1")]);
    const pos = layout.lineTops.get("l1");
    if (!pos) throw new Error("missing layout position");
    expect(pos.height).toBe(MAIN + MAIN + ROW_BORDER);
    expect(pos.height).not.toBe(MAIN + BG_DROP_ZONE_HEIGHT + ROW_BORDER);
  });

  it("does not drift the rows below a line-synced-background row", () => {
    const layout = layoutOf([wordSynced("l1"), lineSyncedBg("l2"), wordSynced("l3")]);
    const bareHeight = MAIN + BG_DROP_ZONE_HEIGHT + ROW_BORDER;
    const bgHeight = MAIN + MAIN + ROW_BORDER;

    expect(layout.lineTops.get("l1")?.top).toBe(WAVEFORM);
    expect(layout.lineTops.get("l2")?.top).toBe(WAVEFORM + bareHeight);
    expect(layout.lineTops.get("l3")?.top).toBe(WAVEFORM + bareHeight + bgHeight);
  });

  it("places mainBottom at the main/background seam of a background row", () => {
    const layout = layoutOf([lineSyncedBg("l1")]);
    const pos = layout.lineTops.get("l1");
    if (!pos) throw new Error("missing layout position");
    expect(pos.mainBottom).toBe(pos.top + MAIN);
  });
});

describe("computeRowLayout invariant: matches the shared row formula", () => {
  it("every row height equals rowHeightOf for the effective line", () => {
    const raw = [wordSynced("l1"), lineSyncedBg("l2"), wordSyncedBg("l3")];
    const layout = layoutOf(raw);
    const effective = getEffectiveLines(raw);
    for (const line of effective) {
      const pos = layout.lineTops.get(line.id);
      if (!pos) throw new Error(`missing layout position for ${line.id}`);
      expect(pos.height).toBe(rowHeightOf(line, MAIN));
    }
  });
});
