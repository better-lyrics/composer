import { useImportFromHash } from "@/hooks/useImportFromHash";
import { usePersistence } from "@/hooks/usePersistence";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { getHashImportSettled, getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectRecord } from "@/lib/project-storage";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const IMPORTED_TITLE = "Imported Song";
const IMPORTED_LINE = { id: "imported-line", text: "imported line", agentId: "v1" };

// -- Helpers ------------------------------------------------------------------

const HashHost: React.FC = () => {
  usePersistence();
  useImportFromHash();
  return <Toaster />;
};

function setHash(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`);
}

function importHash(): string {
  const payload = {
    metadata: { title: IMPORTED_TITLE, artists: [], album: "", duration: 0 },
    agents: [{ id: "v1", type: "person", name: "Lead" }],
    lines: [IMPORTED_LINE],
    granularity: "word",
  };
  return `#import=${encodeURIComponent(JSON.stringify(payload))}`;
}

async function bootWithHash() {
  setHash(importHash());
  const screen = await render(<HashHost />);
  await getPersistenceSettled();
  await getHashImportSettled();
  return screen;
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromHash · projects", () => {
  beforeEach(() => setHash(""));
  afterEach(() => setHash(""));

  it("opens the import in a new project when the open project has lyrics", async () => {
    const alpha = await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    const screen = await bootWithHash();

    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe(IMPORTED_TITLE);
    expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual([IMPORTED_LINE.id]);
    expect(await loadProjectRecord("a")).toEqual(alpha);
    await expect.element(screen.getByText(`Opened “${IMPORTED_TITLE}” in a new project`)).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Switch back" })).toBeInTheDocument();
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it("Switch back returns to the previous project", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    const screen = await bootWithHash();
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
  });

  describe("edge cases", () => {
    it("imports into an open project without lyrics in place, with no prompt", async () => {
      await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), lines: [] } });
      await bootWithHash();

      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe(IMPORTED_TITLE);
      expect(useConfirmStore.getState().isOpen).toBe(false);
    });

    it("imports in place on a first run with no project", async () => {
      await bootWithHash();
      expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual([IMPORTED_LINE.id]);
      expect(useConfirmStore.getState().isOpen).toBe(false);
    });
  });

  describe("invariants", () => {
    it("clears the import hash either way", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await bootWithHash();
      expect(window.location.hash).toBe("");
    });
  });
});
