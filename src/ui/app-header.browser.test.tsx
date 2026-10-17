import { describe, expect, it } from "vitest";
import { AppHeader } from "@/ui/app-header";
import { render } from "@/test/render";

describe("AppHeader", () => {
  it("renders the Composer logo and brand text", async () => {
    const screen = await render(
      <AppHeader screen="editor" onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => {}} />,
      { withRouter: true },
    );
    await expect.element(screen.getByRole("img", { name: "Composer Logo" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Composer");
  });

  it("calls onSettingsOpen when the settings button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader screen="editor" onSettingsOpen={() => calls++} onHelpOpen={() => {}} onTourStart={() => {}} />,
      { withRouter: true },
    );
    await screen.getByRole("button", { name: "Settings" }).click();
    expect(calls).toBe(1);
  });

  it("calls onHelpOpen when the help button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader screen="editor" onSettingsOpen={() => {}} onHelpOpen={() => calls++} onTourStart={() => {}} />,
      { withRouter: true },
    );
    await screen.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    expect(calls).toBe(1);
  });

  it("calls onTourStart when the tour button is clicked", async () => {
    let calls = 0;
    const screen = await render(
      <AppHeader screen="editor" onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => calls++} />,
      { withRouter: true },
    );
    await screen.getByRole("button", { name: "Product tour" }).click();
    expect(calls).toBe(1);
  });

  it("shows the project breadcrumb next to the logo", async () => {
    const screen = await render(
      <AppHeader screen="editor" onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => {}} />,
      { withRouter: true },
    );
    await expect.element(screen.getByRole("navigation", { name: "Project" })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: /Composer/ })).toBeInTheDocument();
  });

  it("shows the Composer brand as a link home in the library", async () => {
    const screen = await render(
      <AppHeader screen="library" onSettingsOpen={() => {}} onHelpOpen={() => {}} onTourStart={() => {}} />,
      { withRouter: true },
    );
    await expect.element(screen.getByRole("link", { name: "Composer, Projects" })).toHaveAttribute("href", "/");
    await expect.element(screen.getByRole("navigation", { name: "Project" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
