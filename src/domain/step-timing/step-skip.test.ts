import { describe, expect, it } from "vitest";
import { stepSkippedLineIds } from "@/domain/step-timing/step-skip";
import { createGroup, createLine } from "@/test/factories";

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { text: "I", sep: " ", begin, end: begin + 0.4 },
      { text: "want", begin: begin + 0.5, end: begin + 1 },
    ],
  });
const lines = [chorus(0, 10), createLine({ id: "v1", text: "Walking home" }), chorus(1, 40), chorus(2, 70)];
const sharing = [createGroup({ id: "g1", sharesTiming: true })];
const nothingCollapsed = () => false;

describe("stepSkippedLineIds", () => {
  it("skips shared repeats that follow a timed copy, and never the copy itself", () => {
    expect([...stepSkippedLineIds(lines, sharing, nothingCollapsed, null)]).toEqual(["c1", "c2"]);
  });

  it("walks the repeat the cursor is already in, so you can retime it there", () => {
    expect([...stepSkippedLineIds(lines, sharing, nothingCollapsed, lines[2])]).toEqual(["c2"]);
  });

  it("skips collapsed groups, even ones with their own timing", () => {
    const own = [createGroup({ id: "g1" })];
    const collapsed = (groupId: string, instanceIdx: number) => groupId === "g1" && instanceIdx === 0;
    expect([...stepSkippedLineIds(lines, own, collapsed, null)]).toEqual(["c0"]);
  });
});
