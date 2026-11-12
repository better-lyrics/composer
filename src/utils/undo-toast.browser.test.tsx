import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { showUndoToast } from "@/utils/undo-toast";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function commitLines(text: string): void {
  useProjectStore.getState().setLinesWithHistory([createLine({ text })]);
}

function currentText(): string | undefined {
  return useProjectStore.getState().lines[0]?.text;
}

// -- Tests --------------------------------------------------------------------

describe("showUndoToast", () => {
  it("undoes its own step", async () => {
    commitLines("First words");
    commitLines("Named step");
    const screen = await render(<Toaster />);
    showUndoToast("Named step done");
    await screen.getByRole("button", { name: "Undo" }).click();
    expect(currentText()).toBe("First words");
  });

  it("regression: a newer history step dismisses the notice and its Undo never undoes that step", async () => {
    commitLines("First words");
    commitLines("Named step");
    const screen = await render(<Toaster />);
    showUndoToast("Named step done");
    const undoButton = screen.getByRole("button", { name: "Undo" });
    await expect.element(undoButton).toBeInTheDocument();
    commitLines("Newer step");
    await expect.element(undoButton).not.toBeInTheDocument();
    expect(currentText()).toBe("Newer step");
  });
});
