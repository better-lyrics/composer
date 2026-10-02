import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import type { LibraryView } from "@/domain/project/library-preferences";
import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { LibraryBody, type LibraryIndexState } from "@/views/library/library-body";
import { describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();
const noop = () => {};

// -- Helpers ------------------------------------------------------------------

function renderBody(
  state: LibraryIndexState,
  projects: readonly ProjectIndexEntry[],
  options: { view?: LibraryView; query?: string; onClearSearch?: () => void } = {},
) {
  return render(
    <LibraryBody
      state={state}
      view={options.view ?? "list"}
      collection={{
        projects,
        now: NOW,
        selectedIds: new Set(),
        menuProjectId: null,
        onOpen: noop,
        onToggleSelect: noop,
        onOpenMenu: noop,
      }}
      query={options.query ?? ""}
      filter="all"
      onClearSearch={options.onClearSearch ?? noop}
      onShowAll={noop}
    />,
  );
}

// -- Tests --------------------------------------------------------------------

describe("LibraryBody", () => {
  it("lists the projects as rows in the list view", async () => {
    const screen = await renderBody("loaded", [
      indexEntry("a", { title: "Alpha" }),
      indexEntry("b", { title: "Bravo" }),
    ]);
    await expect.element(screen.getByRole("list", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
  });

  it("lists the projects as cards in the grid view", async () => {
    const screen = await renderBody(
      "loaded",
      [indexEntry("a", { title: "Alpha" }), indexEntry("b", { title: "Bravo" })],
      {
        view: "grid",
      },
    );
    await expect.element(screen.getByRole("button", { name: "Bravo", exact: true })).toBeInTheDocument();
    expect(screen.getByRole("listitem").elements()).toHaveLength(2);
  });

  describe("edge cases", () => {
    it("renders nothing while the index is loading", async () => {
      const screen = await render(
        <div data-testid="host">
          <LibraryBody
            state="loading"
            view="list"
            collection={{
              projects: [],
              now: NOW,
              selectedIds: new Set(),
              menuProjectId: null,
              onOpen: noop,
              onToggleSelect: noop,
              onOpenMenu: noop,
            }}
            query=""
            filter="all"
            onClearSearch={noop}
            onShowAll={noop}
          />
        </div>,
      );
      expect(screen.getByTestId("host").element().childElementCount).toBe(0);
    });

    it("shows the search empty state when nothing matches", async () => {
      const onClearSearch = vi.fn();
      const screen = await renderBody("loaded", [], { query: "zzz", onClearSearch });
      await expect.element(screen.getByText("No projects match “zzz”")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Clear search" }).click();
      expect(onClearSearch).toHaveBeenCalledOnce();
    });
  });

  describe("error paths", () => {
    it("says the projects could not load when the index failed", async () => {
      const screen = await renderBody("failed", []);
      await expect.element(screen.getByText("Couldn't load your projects")).toBeInTheDocument();
      await expect.element(screen.getByText("Reload the page to try again.")).toBeInTheDocument();
      expect(screen.getByRole("list").elements()).toHaveLength(0);
    });
  });
});
