import { useModalStackStore } from "@/stores/modal-stack";
import { render } from "@/test/render";
import { BulkBar } from "@/views/library/bulk-bar";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function renderBar(selectedCount: number, calls: string[] = []) {
  return render(
    <BulkBar
      selectedCount={selectedCount}
      visibleCount={24}
      onSelectAll={() => calls.push("all")}
      onExport={() => calls.push("export")}
      onDelete={() => calls.push("delete")}
      onClear={() => calls.push("clear")}
    />,
  );
}

// -- Tests --------------------------------------------------------------------

describe("BulkBar", () => {
  it("counts the selection and offers every action", async () => {
    const calls: string[] = [];
    const screen = await renderBar(3, calls);
    const toolbar = screen.getByRole("toolbar", { name: "Selected projects" });
    await expect.element(toolbar).toBeInTheDocument();
    await expect.element(toolbar).toHaveClass("shadow-pop");
    await expect.element(screen.getByText("3 selected")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toHaveClass("text-composer-negative");
    await expect.element(screen.getByRole("button", { name: "Clear selection" })).toHaveClass("text-composer-text/60");
    await screen.getByRole("button", { name: "Select all 24" }).click();
    await screen.getByRole("button", { name: "Export" }).click();
    await screen.getByRole("button", { name: "Delete" }).click();
    await screen.getByRole("button", { name: "Clear selection" }).click();
    expect(calls).toEqual(["all", "export", "delete", "clear"]);
  });

  it("reaches its actions from the keyboard", async () => {
    const calls: string[] = [];
    await renderBar(3, calls);
    await userEvent.keyboard("{Tab}{Tab}{Enter}");
    expect(calls).toEqual(["export"]);
  });

  describe("edge cases", () => {
    it("hides Select all when everything shown is selected", async () => {
      const screen = await renderBar(24);
      await expect.element(screen.getByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
    });

    it("does not render when nothing is selected", async () => {
      const screen = await renderBar(0);
      await expect.element(screen.getByRole("toolbar", { name: "Selected projects" })).not.toBeInTheDocument();
    });

    it("does not render while a modal is open", async () => {
      useModalStackStore.setState({ stack: Array.from({ length: 1 }, () => Symbol("modal")) });
      const screen = await renderBar(3);
      await expect.element(screen.getByRole("toolbar", { name: "Selected projects" })).not.toBeInTheDocument();
    });
  });
});
