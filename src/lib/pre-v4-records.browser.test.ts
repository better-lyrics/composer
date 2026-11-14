import { APP_STATE_STORE_NAME, PROJECT_RECORD_STORE_NAME, getFromStore, setInStore } from "@/lib/persistence-idb";
import { preV4Key } from "@/lib/pre-v4-records";
import { removeProjectData, saveProjectRecord } from "@/lib/project-repository";
import { clearAllProjects } from "@/lib/project-storage";
import { songTitled, storedProject, v4StoredProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

async function updateToV4(id: string, title: string) {
  const old = storedProject(songTitled(title));
  await saveProjectRecord(id, old);
  await saveProjectRecord(id, v4StoredProject(songTitled(`${title} (updated)`)));
  return old;
}

describe("pre-v4 records", () => {
  it("keeps the v3 record once, before the first v4 save", async () => {
    const first = await updateToV4("p1", "First");
    await setInStore(PROJECT_RECORD_STORE_NAME, "p1", storedProject(songTitled("Later")));
    await saveProjectRecord("p1", v4StoredProject(songTitled("Third")));
    expect(await getFromStore(APP_STATE_STORE_NAME, preV4Key("p1"))).toEqual(first);
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
});
