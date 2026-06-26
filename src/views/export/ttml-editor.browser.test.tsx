import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { TtmlEditor } from "@/views/export/ttml-editor";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

type HarnessProps = Omit<React.ComponentProps<typeof TtmlEditor>, "value" | "onChange"> & {
  initialValue?: string;
};

function EditorHarness({ initialValue = "", ...rest }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return <TtmlEditor value={value} onChange={setValue} {...rest} />;
}

// -- Tests --------------------------------------------------------------------

describe("TtmlEditor", () => {
  it("reflects typed edits in the textarea", async () => {
    const screen = await render(
      <EditorHarness
        initialValue="abc"
        generatedTtml="abc"
        hasEdits={false}
        hasConflict={false}
        onRegenerate={() => {}}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    await textarea.fill("xyz");
    await expect.element(textarea).toHaveValue("xyz");
  });

  it("keeps the textarea outside the overflow-auto scroll container", async () => {
    const screen = await render(
      <EditorHarness initialValue="x" generatedTtml="x" hasEdits={false} hasConflict={false} onRegenerate={() => {}} />,
    );
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    expect((textarea.element() as HTMLTextAreaElement).closest(".overflow-auto")).toBeNull();
  });

  describe("conflict", () => {
    it("shows a conflict notice and regenerates on click", async () => {
      const onRegenerate = vi.fn();
      const screen = await render(
        <EditorHarness initialValue="mine" generatedTtml="next" hasEdits hasConflict onRegenerate={onRegenerate} />,
      );
      await expect.element(screen.getByText("The lyrics changed", { exact: false })).toBeInTheDocument();
      await screen.getByRole("button", { name: "Regenerate" }).click();
      expect(onRegenerate).toHaveBeenCalledOnce();
    });
  });

  describe("diff view", () => {
    it("toggles between the editor and a diff of edits vs the latest TTML", async () => {
      const screen = await render(
        <EditorHarness
          initialValue={"line one\nLINE TWO EDITED"}
          generatedTtml={"line one\nline two"}
          hasEdits
          hasConflict={false}
          onRegenerate={() => {}}
        />,
      );
      await expect.element(screen.getByRole("textbox", { name: "Edit TTML content" })).toBeInTheDocument();
      await screen.getByRole("button", { name: "View diff" }).click();
      await expect.element(screen.getByText("LINE TWO EDITED")).toBeInTheDocument();
      expect(screen.container.querySelector("textarea")).toBeNull();
      await screen.getByRole("button", { name: "Hide diff" }).click();
      await expect.element(screen.getByRole("textbox", { name: "Edit TTML content" })).toBeInTheDocument();
    });

    it("offers no diff toggle when there are no edits", async () => {
      const screen = await render(
        <EditorHarness
          initialValue="same"
          generatedTtml="same"
          hasEdits={false}
          hasConflict={false}
          onRegenerate={() => {}}
        />,
      );
      expect(screen.container.querySelector("button")).toBeNull();
    });
  });
});
