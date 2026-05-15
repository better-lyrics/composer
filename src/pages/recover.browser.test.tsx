import { beforeEach, describe, expect, it } from "vitest";
import { RecoverPanel } from "@/pages/recover";
import { render } from "@/test/render";

const DB_NAME = "ttml-composer";
const STORE_NAME = "projects";

async function wipeDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function seedProject(project: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(project, "current");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

describe("RecoverPanel", () => {
  beforeEach(async () => {
    await wipeDB();
  });

  it("shows the empty-state message when IndexedDB has no project", async () => {
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByText(/No saved project found in this browser/)).toBeInTheDocument();
  });

  it("auto-downloads and shows project metadata when a project is present", async () => {
    await seedProject({
      version: 1,
      savedAt: 1715000000000,
      metadata: { title: "AutoSong" },
      lines: [{ id: "a" }, { id: "b" }, { id: "c" }],
    });

    let captured: string | null = null;
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === "a") {
        const anchor = el as HTMLAnchorElement;
        const click = anchor.click.bind(anchor);
        anchor.click = () => {
          captured = anchor.download;
          click();
        };
      }
      return el;
      // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
    }) as any;

    try {
      const screen = await render(<RecoverPanel />);
      await expect.element(screen.getByText(/AutoSong-/)).toBeInTheDocument();
      await expect.element(screen.getByText(/3 lines/)).toBeInTheDocument();
      expect(captured).toMatch(/^AutoSong-/);
    } finally {
      document.createElement = originalCreate;
    }
  });

  it("offers a Download again button after the auto-download succeeds", async () => {
    await seedProject({ version: 1, metadata: { title: "Again" }, lines: [{ id: "a" }] });
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === "a") {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => {};
      }
      return el;
      // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
    }) as any;
    try {
      const screen = await render(<RecoverPanel />);
      await expect.element(screen.getByRole("button", { name: /Download again/ })).toBeInTheDocument();
    } finally {
      document.createElement = originalCreate;
    }
  });
});
