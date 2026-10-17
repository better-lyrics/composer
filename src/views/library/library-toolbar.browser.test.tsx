import type { LibraryFilter } from "@/domain/project/library-view";
import type { LibrarySort } from "@/domain/project/library-order";
import type { LibraryView } from "@/domain/project/library-preferences";
import { render } from "@/test/render";
import { LibraryToolbar } from "@/views/library/library-toolbar";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const COUNTS: Record<LibraryFilter, number> = { all: 24, "not-synced": 6, syncing: 7, synced: 11 };

interface Changes {
  filters: LibraryFilter[];
  queries: string[];
  sorts: LibrarySort[];
  views: LibraryView[];
}

const Harness: React.FC<{ changes: Changes }> = ({ changes }) => {
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("edited");
  const [view, setView] = useState<LibraryView>("list");
  return (
    <LibraryToolbar
      count={24}
      filter={filter}
      counts={COUNTS}
      onFilterChange={(next) => {
        changes.filters.push(next);
        setFilter(next);
      }}
      query={query}
      onQueryChange={(next) => {
        changes.queries.push(next);
        setQuery(next);
      }}
      searchRef={null}
      sort={sort}
      onSortChange={(next) => {
        changes.sorts.push(next);
        setSort(next);
      }}
      view={view}
      onViewChange={(next) => {
        changes.views.push(next);
        setView(next);
      }}
    />
  );
};

function noChanges(): Changes {
  return { filters: [], queries: [], sorts: [], views: [] };
}

// -- Tests --------------------------------------------------------------------

describe("LibraryToolbar", () => {
  it("shows the heading with the project count", async () => {
    const screen = await render(<Harness changes={noChanges()} />);
    await expect.element(screen.getByRole("heading", { name: "Projects 24" })).toBeInTheDocument();
  });

  it("filters by stage with counts", async () => {
    const changes = noChanges();
    const screen = await render(<Harness changes={changes} />);
    await expect.element(screen.getByRole("group", { name: "Filter by progress" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Synced 11" }).click();
    expect(changes.filters).toEqual(["synced"]);
    await expect.element(screen.getByRole("button", { name: "Synced 11" })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches as the user types", async () => {
    const changes = noChanges();
    const screen = await render(<Harness changes={changes} />);
    const search = screen.getByRole("textbox", { name: "Search projects" });
    await expect.element(search).toHaveAttribute("placeholder", "Search");
    await search.click();
    await userEvent.keyboard("m8");
    expect(changes.queries).toEqual(["m", "m8"]);
  });

  it("sorts with the sort menu", async () => {
    const changes = noChanges();
    const screen = await render(<Harness changes={changes} />);
    await screen.getByRole("button", { name: "Sort: Last edited" }).click();
    await screen.getByRole("option", { name: "Title" }).click();
    expect(changes.sorts).toEqual(["title"]);
    await expect.element(screen.getByRole("button", { name: "Sort: Title" })).toBeInTheDocument();
  });

  it("switches between list and grid from the keyboard", async () => {
    const changes = noChanges();
    const screen = await render(<Harness changes={changes} />);
    screen.getByRole("button", { name: "Grid view" }).element().focus();
    await userEvent.keyboard("{Enter}");
    expect(changes.views).toEqual(["grid"]);
    await expect.element(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the search shortcut badge", async () => {
    const screen = await render(<Harness changes={noChanges()} />);
    await expect.element(screen.getByText("/")).toBeInTheDocument();
  });
});
