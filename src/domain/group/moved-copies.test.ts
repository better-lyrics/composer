import { copiesMovedWith } from "@/domain/group/moved-copies";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { reconcileLine } from "@/domain/line/model";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "Hold on",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { text: "Hold ", begin, end: begin + 0.4 },
      { text: "on", begin: begin + 0.5, end: begin + 1 },
    ],
  });

describe("copiesMovedWith", () => {
  it("names exactly the copies a timing edit moves, skipping own-timing instances", () => {
    const groups = [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [2] })];
    const lines = [chorus(0, 10), chorus(1, 40), chorus(2, 70), chorus(3, 100)];
    const nudged = lines.map((line) =>
      line.id === "c0"
        ? reconcileLine({ ...line, words: line.words?.map((word) => ({ ...word, begin: word.begin + 0.2 })) })
        : line,
    );
    const fanOut = sharedTimingFanOut(lines, nudged, groups, ["c0"]);
    const moved = fanOut.lines.filter((line, index) => line !== nudged[index]).map((line) => line.id);

    const copies = copiesMovedWith(lines, groups, ["c0"]);

    expect(copies.lineIdsBySource.get("c0")).toEqual(moved);
    expect(copies.names).toEqual(["Chorus 2", "Chorus 4"]);
  });
});
