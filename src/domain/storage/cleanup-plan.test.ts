import { planCleanup } from "@/domain/storage/cleanup-plan";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

const STEMS = [
  { jobKey: "new|fp32|v2", bytes: 30, createdAt: 300 },
  { jobKey: "old|fp32|v2", bytes: 20, createdAt: 100 },
];
const ENTRIES = [
  indexEntry("recent", { audioKind: "youtube", storedAudioBytes: 40, openedAt: 900, updatedAt: 900 }),
  indexEntry("stale", { audioKind: "youtube", storedAudioBytes: 50, openedAt: 100, updatedAt: 950 }),
  indexEntry("local", { audioKind: "file", storedAudioBytes: 500, openedAt: 1, updatedAt: 1 }),
  indexEntry("streamed", { audioKind: "youtube", storedAudioBytes: 0, openedAt: 2, updatedAt: 2 }),
];

function plan(bytesToFree: number, overrides: Partial<Parameters<typeof planCleanup>[0]> = {}) {
  return planCleanup({
    entries: ENTRIES,
    stemJobs: STEMS,
    isProjectInUse: () => false,
    isStemJobInUse: () => false,
    bytesToFree,
    ...overrides,
  });
}

describe("planCleanup", () => {
  it("removes vocal stems first, oldest first, then YouTube audio least recently opened first", () => {
    expect(plan(10_000)).toEqual([
      { kind: "stems", jobKey: "old|fp32|v2", bytes: 20 },
      { kind: "stems", jobKey: "new|fp32|v2", bytes: 30 },
      { kind: "youtube-audio", projectId: "stale", bytes: 50 },
      { kind: "youtube-audio", projectId: "recent", bytes: 40 },
    ]);
  });

  it("stops as soon as enough is planned", () => {
    expect(plan(21)).toEqual([
      { kind: "stems", jobKey: "old|fp32|v2", bytes: 20 },
      { kind: "stems", jobKey: "new|fp32|v2", bytes: 30 },
    ]);
    expect(plan(20)).toEqual([{ kind: "stems", jobKey: "old|fp32|v2", bytes: 20 }]);
  });

  it("plans nothing when nothing needs freeing", () => {
    expect(plan(0)).toEqual([]);
    expect(plan(-5)).toEqual([]);
  });

  describe("regressions", () => {
    it("regression: a NaN target plans nothing instead of everything", () => {
      expect(plan(Number.NaN)).toEqual([]);
    });
  });

  describe("never removes", () => {
    it("local files", () => {
      expect(plan(10_000).some((step) => step.kind === "youtube-audio" && step.projectId === "local")).toBe(false);
    });

    it("the open project's audio", () => {
      const ids = plan(10_000, { isProjectInUse: (id) => id === "stale" }).flatMap((step) =>
        step.kind === "youtube-audio" ? [step.projectId] : [],
      );
      expect(ids).toEqual(["recent"]);
    });

    it("the open project's stems", () => {
      const keys = plan(10_000, { isStemJobInUse: (jobKey) => jobKey === "old|fp32|v2" }).flatMap((step) =>
        step.kind === "stems" ? [step.jobKey] : [],
      );
      expect(keys).toEqual(["new|fp32|v2"]);
    });
  });

  describe("edge cases", () => {
    it("orders entries without openedAt by their last edit", () => {
      const entries = [
        indexEntry("edited-late", { audioKind: "youtube", storedAudioBytes: 1, updatedAt: 800 }),
        indexEntry("opened-mid", { audioKind: "youtube", storedAudioBytes: 1, openedAt: 500, updatedAt: 999 }),
        indexEntry("edited-early", { audioKind: "youtube", storedAudioBytes: 1, updatedAt: 200 }),
      ];
      const ids = plan(10_000, { entries, stemJobs: [] }).flatMap((step) =>
        step.kind === "youtube-audio" ? [step.projectId] : [],
      );
      expect(ids).toEqual(["edited-early", "opened-mid", "edited-late"]);
    });

    it("breaks ties by id so the plan is stable", () => {
      const entries = [
        indexEntry("b", { audioKind: "youtube", storedAudioBytes: 1, openedAt: 5 }),
        indexEntry("a", { audioKind: "youtube", storedAudioBytes: 1, openedAt: 5 }),
      ];
      const stems = [
        { jobKey: "y", bytes: 1, createdAt: 5 },
        { jobKey: "x", bytes: 1, createdAt: 5 },
      ];
      expect(
        plan(10_000, { entries, stemJobs: stems }).map((step) =>
          step.kind === "stems" ? step.jobKey : step.projectId,
        ),
      ).toEqual(["x", "y", "a", "b"]);
    });

    it("skips empty stem jobs", () => {
      expect(plan(10_000, { entries: [], stemJobs: [{ jobKey: "empty", bytes: 0, createdAt: 1 }] })).toEqual([]);
    });

    it("plans everything removable when the target is larger than all of it", () => {
      expect(plan(10 ** 12)).toHaveLength(4);
      expect(plan(Number.POSITIVE_INFINITY)).toHaveLength(4);
    });
  });

  describe("invariants", () => {
    it("never reorders or changes its inputs", () => {
      const entriesBefore = JSON.stringify(ENTRIES);
      const stemsBefore = JSON.stringify(STEMS);
      plan(10_000);
      expect(JSON.stringify(ENTRIES)).toBe(entriesBefore);
      expect(JSON.stringify(STEMS)).toBe(stemsBefore);
    });
  });
});
