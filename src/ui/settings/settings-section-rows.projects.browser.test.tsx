import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

describe("SettingsSectionRows (projects)", () => {
  it("shows the three settings with their descriptions", async () => {
    const screen = await render(<SettingsSectionRows section="projects" />);
    await expect.element(screen.getByText("Library view")).toBeInTheDocument();
    await expect
      .element(screen.getByText("How the Projects page shows your songs. The toggle on that page changes this too."))
      .toBeInTheDocument();
    await expect.element(screen.getByText("The order projects appear in when you open Projects.")).toBeInTheDocument();
    await expect.element(screen.getByText("What Composer shows when you open it.")).toBeInTheDocument();
  });

  it("switches the library view", async () => {
    const screen = await render(<SettingsSectionRows section="projects" />);
    await screen.getByRole("button", { name: "Grid" }).click();
    expect(useSettingsStore.getState().libraryView).toBe("grid");
    await expect.element(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
  });

  it("picks the default sort", async () => {
    const screen = await render(<SettingsSectionRows section="projects" />);
    await screen.getByRole("button", { name: "Default sort" }).click();
    await screen.getByRole("option", { name: "Artist" }).click();
    expect(useSettingsStore.getState().librarySort).toBe("artist");
  });

  it("picks what shows on launch from the keyboard", async () => {
    const screen = await render(<SettingsSectionRows section="projects" />);
    screen.getByRole("button", { name: "On launch" }).element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("option", { name: "Reopen last project" })).toBeInTheDocument();
    await screen.getByRole("option", { name: "Reopen last project" }).click();
    expect(useSettingsStore.getState().launchScreen).toBe("last-project");
  });

  describe("invariants", () => {
    it("keeps the library view control reachable with the keyboard", async () => {
      const screen = await render(<SettingsSectionRows section="projects" />);
      await userEvent.keyboard("{Tab}");
      await expect.element(screen.getByRole("button", { name: "List" })).toHaveFocus();
    });
  });
});
