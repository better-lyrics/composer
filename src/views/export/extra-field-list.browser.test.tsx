import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { ExtraFieldList } from "@/views/export/extra-field-list";

// -- Helpers ------------------------------------------------------------------

function ExtraHost({ initial = {} as Record<string, string> }) {
  const [extra, setExtra] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setExtra({ imported: "x" })}>
        external
      </button>
      <ExtraFieldList values={extra} onChange={setExtra} />
    </div>
  );
}

// -- Tests --------------------------------------------------------------------

describe("ExtraFieldList", () => {
  it("seeds pairs from the initial record", async () => {
    const screen = await render(<ExtraHost initial={{ spotifyId: "abc" }} />);
    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("spotifyId");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("abc");
  });

  it("adds a key/value pair through onChange", async () => {
    const screen = await render(<ExtraHost />);
    await screen.getByRole("button", { name: "Add field" }).click();
    await screen.getByRole("textbox", { name: "Field 1 key" }).fill("k");
    await screen.getByRole("textbox", { name: "Field 1 value" }).fill("v");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("k");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("v");
  });

  it("reseeds when the record changes externally", async () => {
    const screen = await render(<ExtraHost initial={{ old: "1" }} />);
    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("old");

    await screen.getByRole("button", { name: "external" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("imported");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("x");
  });

  describe("invariants", () => {
    it("keeps an in-progress empty pair after its no-op echo to the store", async () => {
      const screen = await render(<ExtraHost />);
      await screen.getByRole("button", { name: "Add field" }).click();

      await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("");
      await screen.getByRole("textbox", { name: "Field 1 key" }).fill("k");
      await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("k");
    });

    it("keeps focus across consecutive keystrokes in a key input", async () => {
      const screen = await render(<ExtraHost />);
      await screen.getByRole("button", { name: "Add field" }).click();

      const input = screen.getByRole("textbox", { name: "Field 1 key" }).element() as HTMLInputElement;
      await userEvent.click(input);
      await userEvent.type(input, "spotify");

      await expect.poll(() => document.activeElement).toBe(input);
      expect(input.value).toBe("spotify");
    });
  });
});

// -- Reserved keys ------------------------------------------------------------

describe("ExtraFieldList reserved keys", () => {
  it("warns when a key collides with a dedicated metadata field", async () => {
    const screen = await render(<ExtraHost initial={{ mood: "calm" }} />);
    const keyInput = screen.getByRole("textbox", { name: "Field 1 key" });

    await userEvent.fill(keyInput, "songwriter");

    await expect.element(screen.getByText(/reserved key/i)).toBeInTheDocument();
  });

  it("keeps the warning text selectable so it can be copied", async () => {
    const screen = await render(<ExtraHost initial={{ mood: "calm" }} />);
    await userEvent.fill(screen.getByRole("textbox", { name: "Field 1 key" }), "album");

    const warning = screen.getByText(/reserved key/i);
    await expect.element(warning).toHaveClass(/select-text/);
  });

  it("shows no warning for an ordinary key", async () => {
    const screen = await render(<ExtraHost initial={{ mood: "calm" }} />);
    await userEvent.fill(screen.getByRole("textbox", { name: "Field 1 key" }), "spotifyId");

    expect(screen.container.textContent).not.toMatch(/reserved key/i);
  });
});
