import { forkOpenProject, openProject, restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { loadProjectIndexEntry } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { captureLinkTarget, linkProjectToLyric, unlinkProjectsFromLyric } from "@/lib/unison/project-link";
import { useProjectStore } from "@/stores/project";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function seedTwoProjects(): Promise<void> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
  await seedStoredProject("b", { project: songTitled("Bravo") });
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("linkProjectToLyric", () => {
  it("regression: a submit that lands after a project switch links the project it came from", async () => {
    await seedTwoProjects();
    const target = captureLinkTarget();
    await openProject("b");
    await linkProjectToLyric(target, "4217");
    expect((await loadProjectRecord("a"))?.unisonLyricId).toBe("4217");
    expect((await loadProjectIndexEntry("a"))?.unisonLyricId).toBe("4217");
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
    expect(openProjectIdSnapshot()).toBe("b");
  });

  it("regression: a submit that lands after switching away and back links the reopened project", async () => {
    await seedTwoProjects();
    const target = captureLinkTarget();
    await openProject("b");
    await openProject("a");
    await linkProjectToLyric(target, "4217");
    expect(useProjectStore.getState().unisonLyricId).toBe("4217");
    expect((await loadProjectRecord("a"))?.unisonLyricId).toBe("4217");
  });

  it("regression: a submit that lands after a fork links the project it came from, not the fork", async () => {
    await seedTwoProjects();
    const target = captureLinkTarget();
    const forkId = await forkOpenProject();
    await linkProjectToLyric(target, "4217");
    expect((await loadProjectRecord("a"))?.unisonLyricId).toBe("4217");
    expect(openProjectIdSnapshot()).toBe(forkId);
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
  });
});

describe("linkProjectToLyric without a saved project", () => {
  it("regression: links a project that has no id yet", async () => {
    const target = captureLinkTarget();
    await linkProjectToLyric(target, "4217");
    expect(useProjectStore.getState().unisonLyricId).toBe("4217");
  });
});

describe("unlinkProjectsFromLyric", () => {
  it("unlinks the open project and every saved project linked to the lyric", async () => {
    await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), unisonLyricId: "4217" } });
    await seedStoredProject("b", { project: { ...songTitled("Alpha copy"), unisonLyricId: "4217" } });
    await seedStoredProject("c", { project: { ...songTitled("Other"), unisonLyricId: "99" } });
    await restoreOpenProject();
    await unlinkProjectsFromLyric("4217");
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
    expect((await loadProjectRecord("b"))?.unisonLyricId).toBeUndefined();
    expect((await loadProjectRecord("c"))?.unisonLyricId).toBe("99");
  });
});
