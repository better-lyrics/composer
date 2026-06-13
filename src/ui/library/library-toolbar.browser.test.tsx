import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { LibraryToolbar } from "@/ui/library/library-toolbar";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("LibraryToolbar", () => {
  it("calls onFilterChange when a chip is clicked", async () => {
    const onFilter = vi.fn();
    const screen = await render(
      <LibraryToolbar filter="all" onFilterChange={onFilter} sort="recent" onSortChange={() => {}} />,
    );
    await screen.getByRole("tab", { name: "In progress" }).click();
    expect(onFilter).toHaveBeenCalledWith("in-progress");
  });

  it("calls onSortChange when a sort option is selected", async () => {
    const onSort = vi.fn();
    const screen = await render(
      <LibraryToolbar filter="all" onFilterChange={() => {}} sort="recent" onSortChange={onSort} />,
    );
    await screen.getByRole("button", { name: /Recently opened/ }).click();
    await screen.getByRole("menuitem", { name: "Title A to Z" }).click();
    expect(onSort).toHaveBeenCalledWith("title");
  });

  it("renders the current filter as active", async () => {
    const screen = await render(
      <LibraryToolbar filter="synced" onFilterChange={() => {}} sort="recent" onSortChange={() => {}} />,
    );
    const tab = screen.getByRole("tab", { name: "Synced" }).element() as HTMLElement;
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const inactive = screen.getByRole("tab", { name: "All" }).element() as HTMLElement;
    expect(inactive.getAttribute("aria-selected")).toBe("false");
  });

  it("renders the current sort label in the trigger", async () => {
    const screen = await render(
      <LibraryToolbar filter="all" onFilterChange={() => {}} sort="duration" onSortChange={() => {}} />,
    );
    await expect.element(screen.getByRole("button", { name: /Duration/ })).toBeInTheDocument();
  });

  it("closes the sort popover on Escape", async () => {
    const screen = await render(
      <LibraryToolbar filter="all" onFilterChange={() => {}} sort="recent" onSortChange={() => {}} />,
    );
    await screen.getByRole("button", { name: /Recently opened/ }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Title A to Z" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.container.querySelector("[role='dialog']")).toBeNull();
  });

  it("filter chips are keyboard reachable via Tab", async () => {
    const screen = await render(
      <LibraryToolbar filter="all" onFilterChange={() => {}} sort="recent" onSortChange={() => {}} />,
    );
    const firstChip = screen.getByRole("tab", { name: "All" }).element() as HTMLElement;
    firstChip.focus();
    await expect.poll(() => document.activeElement).toBe(firstChip);
  });
});
