import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ErrorFallback } from "@/pages/error-fallback";
import { render } from "@/test/render";
import { allowConsole } from "@/test/console-guard";

const ThrowingRoute: React.FC = () => {
  throw new Error("Boom for test");
};

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

function renderFallback() {
  const router = createMemoryRouter([{ path: "/", element: <ThrowingRoute />, errorElement: <ErrorFallback /> }], {
    initialEntries: ["/"],
  });
  return render(<RouterProvider router={router} />);
}

describe("ErrorFallback", () => {
  beforeEach(() => {
    allowConsole(/Boom for test|route error|RenderErrorBoundary|caught the following error|recovery failed/);
  });
  afterEach(async () => {
    await wipeDB();
  });

  it("renders Reload and Go home buttons when a route throws", async () => {
    const screen = await renderFallback();
    await expect.element(screen.getByRole("button", { name: /Reload/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Go home/ })).toBeInTheDocument();
  });

  it("renders a Download my work button", async () => {
    const screen = await renderFallback();
    await expect.element(screen.getByRole("button", { name: /Download my work/ })).toBeInTheDocument();
  });

  it("shows 'No saved project' message when IndexedDB has nothing to recover", async () => {
    await wipeDB();
    const screen = await renderFallback();
    await screen.getByRole("button", { name: /Download my work/ }).click();
    await expect.element(screen.getByText(/No saved project found/)).toBeInTheDocument();
  });

  it("shows a success message after a successful recovery download", async () => {
    await wipeDB();
    await seedProject({
      version: 1,
      savedAt: Date.now(),
      metadata: { title: "TestSong" },
      lines: [{ id: "a", text: "x", agentId: "v1" }],
    });

    let capturedFilename: string | null = null;
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === "a") {
        const anchor = el as HTMLAnchorElement;
        const click = anchor.click.bind(anchor);
        anchor.click = () => {
          capturedFilename = anchor.download;
          click();
        };
      }
      return el;
      // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
    }) as any;

    try {
      const screen = await renderFallback();
      await screen.getByRole("button", { name: /Download my work/ }).click();
      await expect.element(screen.getByText(/Downloaded/)).toBeInTheDocument();
      expect(capturedFilename).toMatch(/^TestSong-/);
    } finally {
      document.createElement = originalCreate;
      await wipeDB();
    }
  });
});
