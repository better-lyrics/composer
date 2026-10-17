import {
  adoptOpenProjectId,
  bindSaveTarget,
  ensureOpenProjectId,
  findOpenProjectId,
  forgetOpenProjectId,
  openProjectIdSnapshot,
  subscribeOpenProjectId,
} from "@/lib/open-project-session";
import { setOpenProjectId } from "@/lib/project-repository";
import { getOpenProjectId } from "@/lib/project-storage";
import { APP_STATE_STORE_NAME, openDB } from "@/lib/persistence-idb";
import { sleep } from "@/test/async";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function holdAppStateWrites(): Promise<() => void> {
  const db = await openDB();
  const tx = db.transaction(APP_STATE_STORE_NAME, "readwrite");
  let held = true;
  const keepAlive = () => {
    if (held) tx.objectStore(APP_STATE_STORE_NAME).get("hold").onsuccess = keepAlive;
  };
  keepAlive();
  tx.oncomplete = () => db.close();
  return () => {
    held = false;
  };
}

// -- Tests --------------------------------------------------------------------

describe("open-project-session", () => {
  it("publishes the stored pointer once the lookup resolves", async () => {
    await setOpenProjectId("p1");
    expect(openProjectIdSnapshot()).toBeUndefined();
    expect(await findOpenProjectId()).toBe("p1");
    expect(openProjectIdSnapshot()).toBe("p1");
  });

  it("ensureOpenProjectId creates, stores and publishes an id on a fresh install", async () => {
    const id = await ensureOpenProjectId();
    expect(await getOpenProjectId()).toBe(id);
    expect(openProjectIdSnapshot()).toBe(id);
  });

  it("adoptOpenProjectId switches the id at once and notifies subscribers", async () => {
    let notifications = 0;
    const unsubscribe = subscribeOpenProjectId(() => notifications++);
    adoptOpenProjectId("p2");
    expect(openProjectIdSnapshot()).toBe("p2");
    expect(await ensureOpenProjectId()).toBe("p2");
    expect(await findOpenProjectId()).toBe("p2");
    expect(notifications).toBe(1);
    unsubscribe();
  });

  it("forgetOpenProjectId clears the snapshot", () => {
    adoptOpenProjectId("p2");
    forgetOpenProjectId();
    expect(openProjectIdSnapshot()).toBeUndefined();
  });

  describe("invariants", () => {
    it("a target bound before a switch still resolves to the earlier project", async () => {
      adoptOpenProjectId("a");
      const target = bindSaveTarget();
      adoptOpenProjectId("b");
      expect(await target).toBe("a");
      expect(await bindSaveTarget()).toBe("b");
    });

    it("bindSaveTarget returns the same promise while the id does not change", () => {
      adoptOpenProjectId("a");
      expect(bindSaveTarget()).toBe(bindSaveTarget());
    });

    it("adopting the id that is already open notifies nobody", () => {
      adoptOpenProjectId("a");
      let notifications = 0;
      const unsubscribe = subscribeOpenProjectId(() => notifications++);
      adoptOpenProjectId("a");
      expect(notifications).toBe(0);
      unsubscribe();
    });
  });

  describe("regressions", () => {
    it("regression: a slow first lookup never overwrites an id adopted while it ran", async () => {
      await setOpenProjectId("stored");
      const lookup = findOpenProjectId();
      adoptOpenProjectId("adopted");
      await lookup;
      expect(openProjectIdSnapshot()).toBe("adopted");
      expect(await ensureOpenProjectId()).toBe("adopted");
    });

    it("regression: a creation superseded by an adopt never overwrites the pointer", async () => {
      await findOpenProjectId();
      const creation = ensureOpenProjectId();
      adoptOpenProjectId("adopted");
      await setOpenProjectId("adopted");
      expect(await creation).not.toBe("adopted");
      expect(await getOpenProjectId()).toBe("adopted");
      expect(openProjectIdSnapshot()).toBe("adopted");
    });

    it("regression: a creation superseded during its write resolves to its own id", async () => {
      await findOpenProjectId();
      const release = await holdAppStateWrites();
      const creation = ensureOpenProjectId();
      await sleep(0);
      adoptOpenProjectId("adopted");
      release();
      expect(await creation).not.toBe("adopted");
      expect(await getOpenProjectId()).toBe("adopted");
      expect(openProjectIdSnapshot()).toBe("adopted");
    });
  });
});
