import { describe, expect, it } from "vitest";
import { AppHeader } from "@/ui/app-header";
import { render } from "@/test/render";

describe("AppHeader", () => {
  it("renders the Composer logo and brand text", async () => {
    const screen = await render(
      <AppHeader onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => {}} onLibraryOpen={() => {}} />,
    );
    await expect.element(screen.getByRole("img", { name: "Composer Logo" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Composer");
  });

  it("calls onSettingsOpen when the settings button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader
        onSettingsOpen={() => calls++}
        onHelpOpen={() => {}}
        onTourStart={() => {}}
        onLibraryOpen={() => {}}
      />,
    );
    await screen.getByRole("button", { name: "Settings" }).click();
    expect(calls).toBe(1);
  });

  it("calls onHelpOpen when the help button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader
        onSettingsOpen={() => {}}
        onHelpOpen={() => calls++}
        onTourStart={() => {}}
        onLibraryOpen={() => {}}
      />,
    );
    await screen.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    expect(calls).toBe(1);
  });

  it("calls onTourStart when the tour button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader
        onSettingsOpen={() => {}}
        onHelpOpen={() => {}}
        onTourStart={() => calls++}
        onLibraryOpen={() => {}}
      />,
    );
    await screen.getByRole("button", { name: "Product tour" }).click();
    expect(calls).toBe(1);
  });

  it("calls onLibraryOpen when the Library button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader
        onSettingsOpen={() => {}}
        onHelpOpen={() => {}}
        onTourStart={() => {}}
        onLibraryOpen={() => calls++}
      />,
    );
    await screen.getByRole("button", { name: "Library" }).click();
    expect(calls).toBe(1);
  });

  it("renders the Library button as the leftmost in the right icon group", async () => {
    const screen = await render(
      <AppHeader onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => {}} onLibraryOpen={() => {}} />,
    );
    const buttons = Array.from(screen.container.querySelectorAll("header button"));
    const titles = buttons.map((b) => b.getAttribute("title"));
    expect(titles).toEqual(["Library", "Settings", "Product tour", "Keyboard shortcuts (?)"]);
  });
});
