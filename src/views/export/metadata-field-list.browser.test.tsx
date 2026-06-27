import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { MetadataFieldList } from "@/views/export/metadata-field-list";

// -- Helpers ------------------------------------------------------------------

// Controlled host so the field list behaves exactly as it does under the store:
// every edit echoes back through `values`, and the "external" button simulates a
// foreign write (project load / import) that must reseed the buffer.
function ArtistsHost({ initial = [] as string[] }) {
  const [values, setValues] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setValues(["Imported A", "Imported B"])}>
        external
      </button>
      <MetadataFieldList
        label="Artists"
        itemNoun="Artist"
        placeholder="Artist name"
        values={values}
        onChange={setValues}
      />
    </div>
  );
}

// -- Tests --------------------------------------------------------------------

describe("MetadataFieldList", () => {
  it("seeds rows from the initial values", async () => {
    const screen = await render(<ArtistsHost initial={["Alpha", "Beta"]} />);
    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Alpha");
    await expect.element(screen.getByRole("textbox", { name: "Artist 2" })).toHaveValue("Beta");
  });

  it("adds, edits, and removes rows through onChange", async () => {
    const screen = await render(<ArtistsHost />);
    await screen.getByRole("button", { name: "Add artist" }).click();
    await screen.getByRole("textbox", { name: "Artist 1" }).fill("Sia");
    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Sia");

    await screen.getByRole("button", { name: "Remove artist 1" }).click();
    await expect.poll(() => screen.container.querySelector("[aria-label='Artist 1']")).toBeNull();
  });

  it("reseeds when values change externally", async () => {
    const screen = await render(<ArtistsHost initial={["Alpha"]} />);
    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Alpha");

    await screen.getByRole("button", { name: "external" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Imported A");
    await expect.element(screen.getByRole("textbox", { name: "Artist 2" })).toHaveValue("Imported B");
  });

  describe("invariants", () => {
    it("keeps input focus across consecutive keystrokes (no reseed on own edits)", async () => {
      const screen = await render(<ArtistsHost />);
      await screen.getByRole("button", { name: "Add artist" }).click();

      const input = screen.getByRole("textbox", { name: "Artist 1" }).element() as HTMLInputElement;
      await userEvent.click(input);
      await userEvent.type(input, "Sia");

      await expect.poll(() => document.activeElement).toBe(input);
      expect(input.value).toBe("Sia");
    });

    it("supports keyboard: Tab walks from an artist input through its remove button to the next input", async () => {
      const screen = await render(<ArtistsHost initial={["Alpha", "Beta"]} />);
      const first = screen.getByRole("textbox", { name: "Artist 1" }).element() as HTMLInputElement;

      await userEvent.click(first);
      await expect.poll(() => document.activeElement).toBe(first);
      await userEvent.tab();
      await expect
        .poll(() => document.activeElement)
        .toBe(screen.getByRole("button", { name: "Remove artist 1" }).element());
      await userEvent.tab();
      await expect.poll(() => document.activeElement).toBe(screen.getByRole("textbox", { name: "Artist 2" }).element());
    });
  });
});
