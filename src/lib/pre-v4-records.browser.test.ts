import { APP_STATE_STORE_NAME, PROJECT_RECORD_STORE_NAME, getFromStore, setInStore } from "@/lib/persistence-idb";
import { preV4Key } from "@/lib/pre-v4-records";
import { restoreOpenProject } from "@/lib/open-project";
import { saveOpenProjectNow } from "@/lib/persistence-debounce";
import { removeProjectData, saveProjectRecord, setOpenProjectId } from "@/lib/project-repository";
import { clearAllProjects, loadProjectRecord } from "@/lib/project-storage";
import { SAVED_PROJECT_VERSION } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { songTitled, storedProject, v3StoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

async function updateToV4(id: string, title: string) {
  const old = v3StoredProject(songTitled(title));
  await saveProjectRecord(id, old);
  await saveProjectRecord(id, storedProject(songTitled(`${title} (updated)`)));
  return old;
}

describe("pre-v4 records", () => {
  it("keeps the v3 record once, before the first v4 save", async () => {
    const first = await updateToV4("p1", "First");
    await setInStore(PROJECT_RECORD_STORE_NAME, "p1", v3StoredProject(songTitled("Later")));
    await saveProjectRecord("p1", storedProject(songTitled("Third")));
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p1"))).toEqual(first);
  });

  it("keeps a record saved before version 3 too", async () => {
    const old = v3StoredProject({ ...songTitled("Second"), version: 2 });
    await saveProjectRecord("p1", old);
    await saveProjectRecord("p1", storedProject(songTitled("Second (updated)")));
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p1"))).toEqual(old);
  });

  it("goes with its project and with Delete all", async () => {
    await updateToV4("p1", "First");
    const second = await updateToV4("p2", "Second");
    await removeProjectData("p1");
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p1"))).toBeUndefined();
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p2"))).toEqual(second);
    await clearAllProjects();
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p2"))).toBeUndefined();
  });

  it("keeps the v3 record when a project saved before format 4 is opened and saved", async () => {
    const original = v3StoredProject(songTitled("Paper Lanterns"));
    await setInStore(PROJECT_RECORD_STORE_NAME, "p1", original);
    await setOpenProjectId("p1");
    await restoreOpenProject();
    useProjectStore.getState().setMetadata({ title: "Paper Lanterns (edited)" });
    await saveOpenProjectNow();
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p1"))).toEqual(original);
    expect(await loadProjectRecord("p1")).toMatchObject({
      version: SAVED_PROJECT_VERSION,
      metadata: { title: "Paper Lanterns (edited)" },
    });
  });
});
