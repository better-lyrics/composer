import { instanceCount, instanceOrdinal } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { resetAllStores } from "@/test/stores";
import { getEffectiveRows } from "@/views/timeline/utils";
import { beforeEach, describe, expect, it } from "vitest";

function linked(id: string, text: string, instanceIdx: number, templateLineIdx: number, begin: number): LyricLine {
  return { id, text, agentId: "v1", groupId: "g1", instanceIdx, templateLineIdx, begin, end: begin + 1 };
}

function seed() {
  useProjectStore.setState({
    groups: [{ id: "g1", label: "Group 1", color: "#f00", templateVersion: 1 }],
    lines: [
      linked("a0", "Chorus a", 0, 0, 0),
      linked("a1", "Chorus b", 0, 1, 1),
      linked("a2", "Chorus c", 0, 2, 2),
      { id: "v", text: "Verse", agentId: "v1", begin: 4, end: 5 },
      linked("b0", "Chorus a", 1, 0, 6),
      linked("b1", "Chorus b", 1, 1, 7),
      linked("b2", "Chorus c", 1, 2, 8),
    ],
  });
}

function headerKeys(): string[] {
  return getEffectiveRows(useProjectStore.getState().lines).flatMap((r) =>
    r.kind === "group-header" ? [`header:${r.firstLineId}`] : [],
  );
}

function instanceLabels(): string[] {
  const lines = useProjectStore.getState().lines;
  return getEffectiveRows(lines).flatMap((r) =>
    r.kind === "group-header"
      ? [`${instanceOrdinal(lines, r.groupId, r.instanceIdx)} of ${instanceCount(lines, r.groupId)}`]
      : [],
  );
}

describe("instance labels and header keys after detach", () => {
  beforeEach(async () => {
    await resetAllStores();
    seed();
  });

  it("detaching a middle line (gutter Detach line / divergence Detach) keeps header keys unique", () => {
    useProjectStore.getState().detachLine("a1");
    const keys = headerKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("detaching instance 1 of 2 leaves no '2 of 1' label", () => {
    useProjectStore.getState().removeInstance("g1", 0);
    expect(instanceLabels()).not.toContain("2 of 1");
  });
});
