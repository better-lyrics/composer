import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { PROJECT_BUNDLE_FORMAT, buildProjectBundle, projectBundleFileName } from "@/lib/project-bundle";
import { SAVED_PROJECT_VERSION, type SavedProject } from "@/lib/saved-project";
import { describe, expect, it } from "vitest";

function storedProject(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: 1,
    metadata: { title: "Song", artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word",
    primingStripped: true,
    ...overrides,
  };
}

describe("buildProjectBundle", () => {
  it("wraps every project as a portable project file", () => {
    const bundle = buildProjectBundle(
      [
        { id: "a", project: storedProject({ currentStem: "vocals", hasUnexportedImport: true }) },
        { id: "b", project: storedProject() },
      ],
      1_759_000_000_000,
    );
    expect(bundle).toMatchObject({ format: PROJECT_BUNDLE_FORMAT, version: 1, exportedAt: 1_759_000_000_000 });
    expect(bundle.projects.map((project) => project.projectId)).toEqual(["a", "b"]);
    expect(bundle.projects[0]).not.toHaveProperty("currentStem");
    expect(bundle.projects[0]).not.toHaveProperty("hasUnexportedImport");
    expect(bundle.projects[0]?.primingStripped).toBe(true);
  });

  describe("edge cases", () => {
    it("keeps a legacy project without an id", () => {
      const bundle = buildProjectBundle([{ id: undefined, project: storedProject() }], 1);
      expect(bundle.projects[0]).not.toHaveProperty("projectId");
    });

    it("is an empty bundle for no projects", () => {
      expect(buildProjectBundle([], 1).projects).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("survives a JSON round trip unchanged", () => {
      const bundle = buildProjectBundle([{ id: "a", project: storedProject() }], 5);
      expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle);
    });
  });
});

describe("projectBundleFileName", () => {
  it("names the backup after the day", () => {
    expect(projectBundleFileName(new Date("2026-09-27T12:00:00Z"))).toBe(
      "composer-backup-2026-09-27.ttml-projects.json",
    );
  });
});
