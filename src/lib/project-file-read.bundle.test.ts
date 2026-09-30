import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { buildProjectBundle } from "@/lib/project-bundle";
import { parseProjectFileContents } from "@/lib/project-file-read";
import { SAVED_PROJECT_VERSION, type SavedProject } from "@/lib/saved-project";
import { describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

function savedProject(title: string): SavedProject {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: 1,
    metadata: { title, artists: [], album: "", duration: 0 },
    agents: DEFAULT_AGENTS,
    lines: [],
    granularity: "word",
  };
}

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

// -- Tests --------------------------------------------------------------------

describe("parseProjectFileContents", () => {
  it("reads a single project file", () => {
    const contents = parseProjectFileContents(jsonText({ ...savedProject("Alpha"), projectId: "a" }));
    expect(contents.kind).toBe("project");
    expect(contents.kind === "project" ? contents.project.projectId : null).toBe("a");
  });

  it("reads every project in a backup bundle", () => {
    const bundle = buildProjectBundle(
      [
        { id: "a", project: savedProject("Alpha") },
        { id: "b", project: savedProject("Bravo") },
      ],
      1,
    );
    const contents = parseProjectFileContents(jsonText(bundle));
    expect(contents.kind === "bundle" ? contents.projects.map((project) => project.metadata.title) : []).toEqual([
      "Alpha",
      "Bravo",
    ]);
  });

  describe("error paths", () => {
    it("skips unreadable projects in a bundle and counts them", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const bundle = buildProjectBundle([{ id: "a", project: savedProject("Alpha") }], 1);
      const broken = {
        ...bundle,
        projects: [...bundle.projects, { nope: true }, { ...savedProject("Old"), version: 99 }],
      };
      const contents = parseProjectFileContents(jsonText(broken));
      expect(contents).toMatchObject({ kind: "bundle", unreadable: 2 });
      expect(contents.kind === "bundle" ? contents.projects : []).toHaveLength(1);
      expect(warn).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it("rejects a file that is neither a project nor a bundle", () => {
      expect(() => parseProjectFileContents(jsonText({ hello: "world" }))).toThrow("Not a Composer project file");
    });

    it("rejects malformed JSON", () => {
      expect(() => parseProjectFileContents("{")).toThrow(SyntaxError);
    });
  });
});
