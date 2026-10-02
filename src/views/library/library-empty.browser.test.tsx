import { render } from "@/test/render";
import { LibraryEmpty } from "@/views/library/library-empty";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

describe("LibraryEmpty", () => {
  it("explains a search with no results and clears it from the keyboard", async () => {
    let cleared = 0;
    const screen = await render(
      <LibraryEmpty query=" radiohead " filter="all" onClearSearch={() => cleared++} onShowAll={() => {}} />,
    );
    await expect.element(screen.getByText("No projects match “radiohead”")).toBeInTheDocument();
    await expect.element(screen.getByText("Search looks at titles, artists, and albums.")).toBeInTheDocument();
    await userEvent.keyboard("{Tab}{Enter}");
    expect(cleared).toBe(1);
  });

  it("explains an empty filter and shows all again", async () => {
    let shown = 0;
    const screen = await render(
      <LibraryEmpty query="" filter="synced" onClearSearch={() => {}} onShowAll={() => shown++} />,
    );
    await expect.element(screen.getByText("No synced projects yet")).toBeInTheDocument();
    await expect.element(screen.getByText("Try another filter.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Show all" }).click();
    expect(shown).toBe(1);
  });

  describe("edge cases", () => {
    it("names each filter", async () => {
      const syncing = await render(
        <LibraryEmpty query="" filter="syncing" onClearSearch={() => {}} onShowAll={() => {}} />,
      );
      await expect.element(syncing.getByText("No projects in progress")).toBeInTheDocument();
      await syncing.unmount();
      const notSynced = await render(
        <LibraryEmpty query="" filter="not-synced" onClearSearch={() => {}} onShowAll={() => {}} />,
      );
      await expect.element(notSynced.getByText("Every project has some timing")).toBeInTheDocument();
    });

    it("says there are no projects when nothing is left to show", async () => {
      const screen = await render(<LibraryEmpty query="" filter="all" onClearSearch={() => {}} onShowAll={() => {}} />);
      await expect.element(screen.getByText("No projects")).toBeInTheDocument();
      await expect.element(screen.getByText("Start a new song above.")).toBeInTheDocument();
      expect(screen.container.querySelectorAll("button")).toHaveLength(0);
    });

    it("prefers the search message over an empty filter when both apply", async () => {
      const screen = await render(
        <LibraryEmpty query="radiohead" filter="synced" onClearSearch={() => {}} onShowAll={() => {}} />,
      );
      await expect.element(screen.getByText("No projects match “radiohead”")).toBeInTheDocument();
    });
  });
});
