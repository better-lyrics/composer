import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { usePersistence } from "@/hooks/usePersistence";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { seedProject } from "@/test/idb";
import { render } from "@/test/render";

// -- Constants ----------------------------------------------------------------

const SAVED_TITLE = "Midnight City";
const SAVED_ARTIST = "M83";
const LINK_QUERY = "?title=Blinding%20Lights&artist=The%20Weeknd&album=After%20Hours";

const SAVED_LINE = { id: "saved-line", text: "saved line", agentId: "v1" };
const SAVED_AGENT = { id: "v1", type: "person" as const, name: "Saved Lead" };

// -- Helpers ------------------------------------------------------------------

const HookHost: React.FC = () => {
  usePersistence();
  useImportFromQuery();
  return null;
};

function setQuery(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function savedSnapshot() {
  return {
    version: 1,
    savedAt: Date.now(),
    metadata: { title: SAVED_TITLE, artists: [SAVED_ARTIST], album: "", duration: 0 },
    lines: [SAVED_LINE],
    agents: [SAVED_AGENT],
    granularity: "word" as const,
  };
}

async function waitForConfirm(): Promise<void> {
  await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
}

function answerConfirm(value: boolean): void {
  useConfirmStore.getState().resolveAndClose(value, false);
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromQuery guards a restored project", () => {
  beforeEach(() => {
    setQuery("");
  });

  afterEach(() => {
    setQuery("");
  });

  it("asks before replacing the metadata of a restored project", async () => {
    await seedProject(savedSnapshot());
    setQuery(LINK_QUERY);

    await render(<HookHost />);
    await getPersistenceSettled();
    await waitForConfirm();

    expect(useConfirmStore.getState().options?.variant).toBe("destructive");
  });

  it("leaves the restored metadata untouched when the prompt is declined", async () => {
    await seedProject(savedSnapshot());
    setQuery(LINK_QUERY);

    await render(<HookHost />);
    await getPersistenceSettled();
    await waitForConfirm();
    answerConfirm(false);

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe(SAVED_TITLE);
    expect(useProjectStore.getState().metadata.artists).toEqual([SAVED_ARTIST]);
  });

  it("applies the link metadata when the prompt is accepted", async () => {
    await seedProject(savedSnapshot());
    setQuery(LINK_QUERY);

    await render(<HookHost />);
    await getPersistenceSettled();
    await waitForConfirm();
    answerConfirm(true);

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Blinding Lights");
    expect(useProjectStore.getState().metadata.artists).toEqual(["The Weeknd"]);
  });

  it("writes without prompting when there is no project to overwrite", async () => {
    setQuery(LINK_QUERY);

    await render(<HookHost />);
    await getPersistenceSettled();

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Blinding Lights");
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it("offers no 'don't ask again' escape hatch, since metadata is not undoable", async () => {
    await seedProject(savedSnapshot());
    setQuery(LINK_QUERY);

    await render(<HookHost />);
    await getPersistenceSettled();
    await waitForConfirm();

    expect(useConfirmStore.getState().options?.settingsKey).toBeUndefined();
  });
});
