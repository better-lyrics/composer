import { render } from "@/test/render";
import { TtmlEditor } from "@/views/export/ttml-editor";
import { useState } from "react";
import { describe, expect, it } from "vitest";

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

describe("TtmlEditor · highlighting", () => {
  const VALID = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000">Hello</p></div></body></tt>`;

  function layerIn(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>(".bh-edit > .bh-layer");
  }

  it("highlights the TTML under the textarea", async () => {
    const screen = await render(<EditorHarness initialValue={VALID} generatedTtml={VALID} />);
    const layer = layerIn(screen.container);
    expect(layer?.textContent).toBe(VALID);
    expect([...(layer?.querySelectorAll(".bh-timestamp") ?? [])].map((stamp) => stamp.textContent)).toEqual([
      "00:01.000",
      "00:02.000",
    ]);
  });

  it("keeps highlighting a TTML edit that no longer looks like TTML", async () => {
    const fragment = `<p begin="00:01.000" end="00:02.000">Hello</p>`;
    const screen = await render(<EditorHarness initialValue={fragment} generatedTtml={VALID} />);
    expect(layerIn(screen.container)?.querySelectorAll(".bh-timestamp")).toHaveLength(2);
  });

  it("re-highlights when the value is replaced from outside", async () => {
    const screen = await render(<TtmlEditor value={VALID} generatedTtml={VALID} onChange={() => {}} />);
    const replaced = VALID.replace("Hello", "Regenerated");
    await screen.rerender(<TtmlEditor value={replaced} generatedTtml={replaced} onChange={() => {}} />);
    expect(layerIn(screen.container)?.textContent).toBe(replaced);
  });

  it("highlights again after hiding the diff", async () => {
    const edited = VALID.replace("Hello", "Edited");
    const screen = await render(<EditorHarness initialValue={edited} generatedTtml={VALID} />);
    await screen.getByRole("button", { name: "View diff" }).click();
    expect(layerIn(screen.container)).toBeNull();
    await screen.getByRole("button", { name: "Hide diff" }).click();
    await expect.poll(() => layerIn(screen.container)?.textContent).toBe(edited);
  });
});
