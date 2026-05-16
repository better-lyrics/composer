import { describe, expect, it } from "vitest";
import { RecoverPanel } from "@/pages/recover";
import { render } from "@/test/render";

const DB_NAME = "ttml-composer";
const STORE_NAME = "projects";

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
  it("shows the empty-state message when IndexedDB has no project", async () => {
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByText(/Nothing saved in this browser yet/)).toBeInTheDocument();
  });

  it("hides the Download button when there is nothing to recover", async () => {
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByText(/Nothing saved in this browser yet/)).toBeInTheDocument();
    const buttons = Array.from(screen.container.querySelectorAll("button")).map((b) => b.textContent?.trim() ?? "");
    expect(buttons.some((t) => /Download/.test(t))).toBe(false);
    expect(buttons.some((t) => /Back to Composer/.test(t))).toBe(true);
  });

  it("auto-downloads and shows project metadata when a project is present", async () => {
    await seedProject({
      version: 1,
      savedAt: 1715000000000,
      metadata: { title: "AutoSong" },
      lines: [
        { id: "a", text: "x", agentId: "v1" },
        { id: "b", text: "y", agentId: "v1" },
        { id: "c", text: "z", agentId: "v1" },
      ],
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
    await seedProject({ version: 1, metadata: { title: "Again" }, lines: [{ id: "a", text: "x", agentId: "v1" }] });
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
