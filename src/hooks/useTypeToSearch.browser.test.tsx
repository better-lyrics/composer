import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useTypeToSearch } from "@/hooks/useTypeToSearch";
import { useModalStackStore } from "@/stores/modal-stack";
import { render } from "@/test/render";

// -- Harness -------------------------------------------------------------------

const Harness: React.FC<{ initial?: string }> = ({ initial = "" }) => {
  const [query, setQuery] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useTypeToSearch(inputRef, query, setQuery);
  return (
    <div>
      <button type="button">elsewhere</button>
      <input ref={inputRef} aria-label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <textarea aria-label="Notes" />
    </div>
  );
};

const focusElsewhere = (screen: Awaited<ReturnType<typeof render>>) =>
  (screen.getByRole("button", { name: "elsewhere" }).element() as HTMLElement).focus();

// -- Tests ---------------------------------------------------------------------

describe("useTypeToSearch", () => {
  it("routes letters typed anywhere into the search", async () => {
    const screen = await render(<Harness />);
    focusElsewhere(screen);
    await userEvent.keyboard("snap");
    await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("snap");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search" }).element());
  });

  it("focuses the search on slash without typing it", async () => {
    const screen = await render(<Harness />);
    focusElsewhere(screen);
    await userEvent.keyboard("/");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search" }).element());
    await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
  });

  it("clears a query on Escape and swallows that Escape", async () => {
    const screen = await render(<Harness initial="snap" />);
    let bubbledEscapes = 0;
    const countEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") bubbledEscapes++;
    };
    document.addEventListener("keydown", countEscape);
    focusElsewhere(screen);
    await userEvent.keyboard("{Escape}");
    document.removeEventListener("keydown", countEscape);
    await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    expect(bubbledEscapes).toBe(0);
  });

  describe("edge cases", () => {
    it("lets Escape through when the query is already empty", async () => {
      const screen = await render(<Harness />);
      let bubbledEscapes = 0;
      const countEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") bubbledEscapes++;
      };
      document.addEventListener("keydown", countEscape);
      focusElsewhere(screen);
      await userEvent.keyboard("{Escape}");
      document.removeEventListener("keydown", countEscape);
      expect(bubbledEscapes).toBe(1);
    });

    it("leaves other text fields alone", async () => {
      const screen = await render(<Harness />);
      (screen.getByRole("textbox", { name: "Notes" }).element() as HTMLElement).focus();
      await userEvent.keyboard("hi");
      await expect.element(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("hi");
      await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    });

    it("ignores modified keys and space", async () => {
      const screen = await render(<Harness />);
      focusElsewhere(screen);
      await userEvent.keyboard("{Control>}k{/Control} ");
      await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    });

    it("does not steal keys while a nested modal is open", async () => {
      useModalStackStore.setState({ count: 2 });
      const screen = await render(<Harness />);
      focusElsewhere(screen);
      await userEvent.keyboard("a");
      await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    });

    it("ignores keys another handler already claimed", async () => {
      const screen = await render(<Harness />);
      const claim = (event: KeyboardEvent) => event.preventDefault();
      window.addEventListener("keydown", claim, true);
      focusElsewhere(screen);
      await userEvent.keyboard("a");
      window.removeEventListener("keydown", claim, true);
      await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    });
  });
});
