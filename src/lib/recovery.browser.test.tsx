import { beforeEach, describe, expect, it } from "vitest";
import { downloadRecoveryFile, readRecoveryMetadata } from "@/lib/recovery";

// -- Helpers ------------------------------------------------------------------

const DB_NAME = "ttml-composer";
const STORE_NAME = "projects";
const CURRENT_KEY = "current";

async function wipeDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
    req.onblocked = () => resolve();
  });
}

async function seedProject(project: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const put = tx.objectStore(STORE_NAME).put(project, CURRENT_KEY);
      put.onerror = () => {
        db.close();
        reject(put.error);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

function captureDownload(): { resolve: () => Promise<{ filename: string; size: number }>; cleanup: () => void } {
  let captured: { filename: string; size: number } | null = null;
  const originalCreate = document.createElement.bind(document);
  const originalAppend = document.body.appendChild.bind(document.body);

  document.createElement = ((tag: string) => {
    const el = originalCreate(tag);
    if (tag.toLowerCase() === "a") {
      const anchor = el as HTMLAnchorElement;
      const originalClick = anchor.click.bind(anchor);
      anchor.click = () => {
        captured = { filename: anchor.download, size: 0 };
        const blob = anchor.href;
        if (blob.startsWith("blob:")) {
          fetch(blob)
            .then((res) => res.blob())
            .then((b) => {
              if (captured) captured.size = b.size;
            })
            .catch(() => {});
        }
        originalClick();
      };
    }
    return el;
    // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
  }) as any;

  return {
    resolve: async () => {
      for (let i = 0; i < 20 && (!captured || captured.size === 0); i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
      if (!captured) throw new Error("download was not triggered");
      return captured;
    },
    cleanup: () => {
      document.createElement = originalCreate;
      document.body.appendChild = originalAppend;
    },
  };
}

// -- Tests --------------------------------------------------------------------

describe("recovery", () => {
  beforeEach(async () => {
    await wipeDB();
  });

  describe("readRecoveryMetadata", () => {
    it("returns found=false when IndexedDB has no project", async () => {
      const result = await readRecoveryMetadata();
      expect(result.found).toBe(false);
      expect(result.lineCount).toBe(0);
    });

    it("returns title, line count, and savedAt from the stored project", async () => {
      await seedProject({
        version: 1,
        savedAt: 1715000000000,
        metadata: { title: "Drift" },
        lines: [{ id: "a" }, { id: "b" }, { id: "c" }],
      });
      const result = await readRecoveryMetadata();
      expect(result.found).toBe(true);
      expect(result.title).toBe("Drift");
      expect(result.lineCount).toBe(3);
      expect(result.savedAt).toBe(1715000000000);
      expect(result.filename).toMatch(/^Drift-\d{4}-\d{2}-\d{2}\.ttml-project\.json$/);
    });

    it("falls back to 'recovered' when metadata.title is missing or empty", async () => {
      await seedProject({ version: 1, lines: [], metadata: { title: "  " } });
      const result = await readRecoveryMetadata();
      expect(result.title).toBe("recovered");
      expect(result.filename).toMatch(/^recovered-/);
    });
  });

  describe("downloadRecoveryFile", () => {
    it("triggers a file download with the project JSON when one exists", async () => {
      await seedProject({
        version: 1,
        savedAt: 1715000000000,
        metadata: { title: "Drift" },
        lines: [{ id: "a", text: "first line" }],
      });
      const capture = captureDownload();
      try {
        const result = await downloadRecoveryFile();
        expect(result.found).toBe(true);
        const dl = await capture.resolve();
        expect(dl.filename).toMatch(/^Drift-\d{4}-\d{2}-\d{2}\.ttml-project\.json$/);
        expect(dl.size).toBeGreaterThan(0);
      } finally {
        capture.cleanup();
      }
    });

    it("returns found=false without throwing when IndexedDB has no project", async () => {
      const result = await downloadRecoveryFile();
      expect(result.found).toBe(false);
    });
  });
});
