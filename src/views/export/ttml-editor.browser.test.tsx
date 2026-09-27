import { describe, expect, it } from "vitest";
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
    const screen = await render(<EditorHarness initialValue="abc" generatedTtml="abc" />);
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    await textarea.fill("xyz");
    await expect.element(textarea).toHaveValue("xyz");
  });

  it("keeps the textarea outside the overflow-auto scroll container", async () => {
    const screen = await render(<EditorHarness initialValue="x" generatedTtml="x" />);
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    expect((textarea.element() as HTMLTextAreaElement).closest(".overflow-auto")).toBeNull();
  });

  describe("diff view", () => {
    it("toggles between the editor and a diff of edits vs the latest TTML", async () => {
      const screen = await render(
        <EditorHarness initialValue={"line one\nLINE TWO EDITED"} generatedTtml={"line one\nline two"} />,
      );
      await expect.element(screen.getByRole("textbox", { name: "Edit TTML content" })).toBeInTheDocument();
      await screen.getByRole("button", { name: "View diff" }).click();
      await expect.element(screen.getByText("LINE TWO EDITED")).toBeInTheDocument();
      expect(screen.container.querySelector("textarea")).toBeNull();
      await screen.getByRole("button", { name: "Hide diff" }).click();
      await expect.element(screen.getByRole("textbox", { name: "Edit TTML content" })).toBeInTheDocument();
    });

    it("offers no diff toggle when there are no edits", async () => {
      const screen = await render(<EditorHarness initialValue="same" generatedTtml="same" />);
      expect(screen.container.querySelector("button")).toBeNull();
    });
  });
});

describe("TtmlEditor · XML status", () => {
  const VALID = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p>Hello</p></div></body></tt>`;

  it("shows an XML error while the edit is not well-formed", async () => {
    const screen = await render(<EditorHarness initialValue={VALID} generatedTtml={VALID} />);
    await screen.getByRole("textbox", { name: "Edit TTML content" }).fill(VALID.replace("</tt>", ""));
    await expect.element(screen.getByRole("alert")).toHaveTextContent(/XML error/);
  });

  it("clears the XML error once the edit is well-formed again", async () => {
    const screen = await render(<EditorHarness initialValue={VALID} generatedTtml={VALID} />);
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    await textarea.fill(VALID.replace("</tt>", ""));
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    await textarea.fill(VALID.replace("Hello", "Hi"));
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no XML error for a well-formed edit", async () => {
    const screen = await render(<EditorHarness initialValue={VALID} generatedTtml={VALID} />);
    await screen.getByRole("textbox", { name: "Edit TTML content" }).fill(VALID.replace("Hello", "Hi"));
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });
});
