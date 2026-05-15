import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { usePanicRecovery } from "@/hooks/usePanicRecovery";
import { isMac } from "@/utils/platform";

const DB_NAME = "ttml-composer";
const STORE_NAME = "projects";

async function seedProject(): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(
        { version: 1, metadata: { title: "Hooked" }, lines: [{ id: "x", text: "x", agentId: "v1" }] },
        "current",
      );
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

function captureDownloads(): { filenames: string[]; cleanup: () => void } {
  const filenames: string[] = [];
  const originalCreate = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = originalCreate(tag);
    if (tag.toLowerCase() === "a") {
      const anchor = el as HTMLAnchorElement;
      const click = anchor.click.bind(anchor);
      anchor.click = () => {
        filenames.push(anchor.download);
        click();
      };
    }
    return el;
    // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
  }) as any;
  return {
    filenames,
    cleanup: () => {
      document.createElement = originalCreate;
    },
  };
}

function dispatchPanicCombo(extra: Partial<KeyboardEventInit> = {}): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "e",
      shiftKey: true,
      altKey: true,
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      ...extra,
    }),
  );
}

describe("usePanicRecovery", () => {
  it("downloads the project on the panic combo", async () => {
    await seedProject();
    const capture = captureDownloads();
    try {
      await renderHook(() => usePanicRecovery());
      dispatchPanicCombo();
      for (let i = 0; i < 30 && capture.filenames.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(capture.filenames.length).toBe(1);
      expect(capture.filenames[0]).toMatch(/^Hooked-/);
    } finally {
      capture.cleanup();
    }
  });

  it("ignores repeat=true keydowns to defend against stuck-key auto-repeat", async () => {
    await seedProject();
    const capture = captureDownloads();
    try {
      await renderHook(() => usePanicRecovery());
      for (let i = 0; i < 10; i++) dispatchPanicCombo({ repeat: true });
      await new Promise((r) => setTimeout(r, 50));
      expect(capture.filenames.length).toBe(0);
    } finally {
      capture.cleanup();
    }
  });

  it("does not fire when the modifier is missing", async () => {
    await seedProject();
    const capture = captureDownloads();
    try {
      await renderHook(() => usePanicRecovery());
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", shiftKey: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(capture.filenames.length).toBe(0);
    } finally {
      capture.cleanup();
    }
  });
});
