/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { ROMAJI_BAND_HEIGHT } from "@/views/timeline/get-effective-line-main-height";
import { computeRowLayout } from "@/views/timeline/utils";

// -- Constants ----------------------------------------------------------------

const DEFAULT_ROW_HEIGHT = 44;
const BG_DROP_ZONE_HEIGHT = 24;
const GROUP_HEADER_HEIGHT = 26;
const WAVEFORM_HEIGHT = 80;

// -- Fixtures -----------------------------------------------------------------

function plainLine(id: string): LyricLine {
  return reconcileLine({
    id,
    text: "Hello world",
    agentId: "v1",
    words: [{ text: "Hello world", begin: 0, end: 1 }],
  });
}

function romanizedLine(id: string): LyricLine {
  return reconcileLine({
    id,
    text: "夜だけど",
    agentId: "v1",
    words: [{ text: "夜だけど", begin: 0, end: 1 }],
    romanization: { text: "yoru dakedo", source: "generated" },
  });
}

function romanizedLineWithBg(id: string): LyricLine {
  return reconcileLine({
    id,
    text: "夜だけど",
    agentId: "v1",
    words: [{ text: "夜だけど", begin: 0, end: 1 }],
    backgroundWords: [{ text: "(echo)", begin: 0, end: 1 }],
    romanization: { text: "yoru dakedo", source: "generated" },
  });
}

function defaultInputs(lines: LyricLine[]) {
  return {
    lines,
    rowHeights: {},
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
    collapsedInstances: {},
    waveformHeight: WAVEFORM_HEIGHT,
    bgDropZoneHeight: BG_DROP_ZONE_HEIGHT,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  };
}

// -- Tests --------------------------------------------------------------------

describe("computeRowLayout · romanization adjustment", () => {
  it("returns base main-band height for a plain line", () => {
    const lines = [plainLine("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.mainHeight).toBe(DEFAULT_ROW_HEIGHT);
  });

  it("returns base + ROMAJI_BAND_HEIGHT for a romanized line", () => {
    const lines = [romanizedLine("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.mainHeight).toBe(DEFAULT_ROW_HEIGHT + ROMAJI_BAND_HEIGHT);
  });

  it("keeps the bg-zone height unaffected by romanization", () => {
    const lines = [romanizedLineWithBg("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.bgHeight).toBe(DEFAULT_ROW_HEIGHT);
  });

  it("uses bg-drop-zone height when the line has no background words even if romanized", () => {
    const lines = [romanizedLine("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.bgHeight).toBe(BG_DROP_ZONE_HEIGHT);
  });

  it("propagates total height = main + bg + 1px border", () => {
    const lines = [romanizedLine("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.height).toBe(DEFAULT_ROW_HEIGHT + ROMAJI_BAND_HEIGHT + BG_DROP_ZONE_HEIGHT + 1);
  });

  it("stacks plain rows starting from the waveform top, with consistent strides", () => {
    const lines = [plainLine("L1"), plainLine("L2"), plainLine("L3")];
    const layout = computeRowLayout(defaultInputs(lines));
    const a = layout.lineTops.get("L1");
    const b = layout.lineTops.get("L2");
    const c = layout.lineTops.get("L3");
    expect(a?.top).toBe(WAVEFORM_HEIGHT);
    expect(b?.top).toBe(WAVEFORM_HEIGHT + (a?.height ?? 0));
    expect(c?.top).toBe(WAVEFORM_HEIGHT + (a?.height ?? 0) + (b?.height ?? 0));
  });

  it("shifts subsequent rows down by the romaji band when a prior row is romanized", () => {
    const linesA = [plainLine("L1"), plainLine("L2"), plainLine("L3")];
    const linesB = [romanizedLine("L1"), plainLine("L2"), plainLine("L3")];
    const layoutA = computeRowLayout(defaultInputs(linesA));
    const layoutB = computeRowLayout(defaultInputs(linesB));
    const aL2 = layoutA.lineTops.get("L2")?.top ?? 0;
    const bL2 = layoutB.lineTops.get("L2")?.top ?? 0;
    expect(bL2 - aL2).toBe(ROMAJI_BAND_HEIGHT);
  });

  it("respects per-line user resize overrides for the base band", () => {
    const lines = [romanizedLine("L1")];
    const layout = computeRowLayout({ ...defaultInputs(lines), rowHeights: { L1: 80 } });
    const pos = layout.lineTops.get("L1");
    expect(pos?.mainHeight).toBe(80 + ROMAJI_BAND_HEIGHT);
  });

  it("never produces a mainHeight smaller than the resized base", () => {
    const lines = [plainLine("L1"), romanizedLine("L2")];
    const layout = computeRowLayout({ ...defaultInputs(lines), rowHeights: { L1: 30, L2: 30 } });
    const plain = layout.lineTops.get("L1");
    const roman = layout.lineTops.get("L2");
    expect(plain?.mainHeight).toBe(30);
    expect(roman?.mainHeight).toBe(30 + ROMAJI_BAND_HEIGHT);
  });

  it("does not duplicate the romaji adder when both main and bg bands are present", () => {
    const lines = [romanizedLineWithBg("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos?.mainHeight - DEFAULT_ROW_HEIGHT).toBe(ROMAJI_BAND_HEIGHT);
    expect(pos?.bgHeight).toBe(DEFAULT_ROW_HEIGHT);
  });
});

describe("computeRowLayout · romanization invariants", () => {
  it("returns immutable position records (consumers don't mutate)", () => {
    const lines = [romanizedLine("L1")];
    const layout = computeRowLayout(defaultInputs(lines));
    const pos = layout.lineTops.get("L1");
    expect(pos).toBeDefined();
    if (!pos) return;
    const before = { ...pos };
    expect(pos.top).toBe(before.top);
    expect(pos.height).toBe(before.height);
  });

  it("turning a romanized line into a plain one shrinks the stack by ROMAJI_BAND_HEIGHT", () => {
    const romaniLines = [romanizedLine("L1"), plainLine("L2")];
    const plainLines = [plainLine("L1"), plainLine("L2")];
    const a = computeRowLayout(defaultInputs(romaniLines)).lineTops.get("L2")?.top ?? 0;
    const b = computeRowLayout(defaultInputs(plainLines)).lineTops.get("L2")?.top ?? 0;
    expect(a - b).toBe(ROMAJI_BAND_HEIGHT);
  });
});
