import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { reconcileLine } from "@/domain/line/model";
import { SAVED_PROJECT_VERSION, type SavedProject, upgradeSavedProject } from "@/lib/saved-project";
import { describe, expect, it } from "vitest";

function legacyProject(version: SavedProject["version"]): SavedProject {
  return {
    version,
    savedAt: 1,
    metadata: { title: "Legacy", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    granularity: "word",
    lines: [
      reconcileLine({
        id: "L1",
        text: "걸음은 Like a dance",
        agentId: "v1",
        transliteration: {
          language: "ko-Latn",
          text: "geol-eum-eun Like a dance",
          segments: [],
          origin: "google",
          sourceFingerprint: "legacy",
        },
      }),
    ],
  };
}

describe("upgradeSavedProject", () => {
  it("upgrades a version 1 record: transliterations migrate and the version becomes current", () => {
    const project = legacyProject(1);
    expect(upgradeSavedProject(project)).toBe(true);
    expect(project.version).toBe(SAVED_PROJECT_VERSION);
    expect(project.lines[0].transliteration?.text).toBe("geol eum eun  Like  a  dance");
    expect(project.lines[0].transliteration?.alignmentStatus).toBe("confirmed");
  });

  it("upgrades a version 2 record", () => {
    const project = legacyProject(2);
    expect(upgradeSavedProject(project)).toBe(true);
    expect(project.version).toBe(SAVED_PROJECT_VERSION);
  });

  describe("invariants", () => {
    it("leaves a current record untouched and reports no change", () => {
      const project = legacyProject(3);
      const lines = project.lines;
      expect(upgradeSavedProject(project)).toBe(false);
      expect(project.lines).toBe(lines);
    });

    it("is idempotent", () => {
      const project = legacyProject(1);
      upgradeSavedProject(project);
      const once = structuredClone(project);
      expect(upgradeSavedProject(project)).toBe(false);
      expect(project).toEqual(once);
    });
  });

  describe("edge cases", () => {
    it("tolerates a malformed record whose lines are not an array", () => {
      const project = { ...legacyProject(1), lines: undefined } as unknown as SavedProject;
      expect(upgradeSavedProject(project)).toBe(true);
      expect(project.version).toBe(SAVED_PROJECT_VERSION);
    });
  });
});
