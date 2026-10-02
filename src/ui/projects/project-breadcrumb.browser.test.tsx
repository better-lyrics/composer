import { useProjectShortcuts } from "@/hooks/useProjectShortcuts";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { assignBinding } from "@/stores/shortcut-bindings";
import { useUIStore } from "@/stores/ui";
import { TRUNCATION_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ProjectBreadcrumb } from "@/ui/projects/project-breadcrumb";
import { isMac } from "@/utils/platform";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const ShortcutHost: React.FC = () => {
  useProjectShortcuts();
  return <ProjectBreadcrumb />;
};

async function seedTwo(): Promise<void> {
  await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), savedAt: 10 } });
  await seedStoredProject("b", { project: { ...songTitled("Bravo"), savedAt: 20 } });
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("ProjectBreadcrumb", () => {
  it("shows the open project's title in the switch trigger", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    await expect.element(screen.getByRole("button", { name: "Alpha, switch project" })).toBeInTheDocument();
    await expect.element(screen.getByRole("navigation", { name: "Project" })).toBeInTheDocument();
  });

  it("clicking the title opens the switcher with the search focused", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    const trigger = screen.getByRole("button", { name: /switch project/ });
    await trigger.click();
    await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
    await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    expect(useUIStore.getState().projectSwitcherOpen).toBe(true);
  });

  it("the Projects crumb links to the library", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    const crumb = screen.getByRole("link", { name: "Projects" });
    await expect.element(crumb).toHaveAttribute("href", "/");
    await expect.element(screen.getByRole("dialog", { name: "Switch project" })).not.toBeInTheDocument();
  });

  it("opens when the store asks, as Mod+O does", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    useUIStore.getState().setProjectSwitcherOpen(true);
    await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
    await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
  });

  it("names the switch shortcut in the trigger tooltip and follows a remap", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    const trigger = screen.getByRole("button", { name: /switch project/ });
    await expect.element(trigger).toHaveAttribute("title", `Switch project (${isMac ? "⌘O" : "Ctrl+O"})`);
    assignBinding("global.openProjectSwitcher", { key: "p", mod: true });
    await expect.element(trigger).toHaveAttribute("title", `Switch project (${isMac ? "⌘P" : "Ctrl+P"})`);
  });

  it("keeps the save status outside the navigation landmark", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    const nav = screen.getByRole("navigation", { name: "Project" }).element();
    expect(nav.querySelector('[role="status"]')).toBeNull();
    expect(screen.container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("choosing a project switches to it and closes the switcher", async () => {
    await seedTwo();
    const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
    await screen.getByRole("button", { name: /switch project/ }).click();
    await screen.getByRole("option", { name: /Bravo/ }).click();
    await expect.poll(openProjectIdSnapshot).toBe("b");
    expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
    await expect.element(screen.getByRole("button", { name: "Bravo, switch project" })).toBeInTheDocument();
  });

  describe("keyboard", () => {
    it("Escape closes the switcher and returns focus to the trigger", async () => {
      await seedTwo();
      const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
      const trigger = screen.getByRole("button", { name: /switch project/ });
      await trigger.click();
      await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => useUIStore.getState().projectSwitcherOpen).toBe(false);
      await expect.element(trigger).toHaveFocus();
    });

    it("Mod+O opens the switcher with the search focused", async () => {
      await seedTwo();
      const screen = await render(<ShortcutHost />, { withRouter: true });
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "o", code: "KeyO", bubbles: true, metaKey: isMac, ctrlKey: !isMac }),
      );
      await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
    });

    it("an outside click closes the switcher and returns focus to the trigger", async () => {
      await seedTwo();
      const screen = await render(
        <>
          <ProjectBreadcrumb />
          <p style={{ position: "fixed", right: 0, bottom: 0 }}>Outside</p>
        </>,
        { withRouter: true },
      );
      const trigger = screen.getByRole("button", { name: /switch project/ });
      await trigger.click();
      await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
      await screen.getByText("Outside").click();
      await expect.poll(() => useUIStore.getState().projectSwitcherOpen).toBe(false);
      await expect.element(trigger).toHaveFocus();
    });

    it("Enter on the trigger opens the switcher", async () => {
      await seedTwo();
      const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
      screen
        .getByRole("button", { name: /switch project/ })
        .element()
        .focus();
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("names a project without a title Untitled", async () => {
      const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
      await expect.element(screen.getByRole("button", { name: "Untitled, switch project" })).toBeInTheDocument();
    });

    it("caps a long title and truncates it", async () => {
      await seedTwo();
      useProjectStore.getState().setMetadata({ title: "A very long song title ".repeat(12) });
      const utilities = installStyleSheet(TRUNCATION_UTILITIES_CSS);
      const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
      const trigger = screen.getByRole("button", { name: /switch project/ }).element();
      const titleText = trigger.querySelector(".truncate");
      if (!(titleText instanceof HTMLElement)) throw new Error("expected the title text");
      expect(trigger.getBoundingClientRect().width).toBeLessThanOrEqual(380);
      expect(titleText.scrollWidth).toBeGreaterThan(titleText.clientWidth);
      utilities.remove();
    });

    it("follows title edits in the open project", async () => {
      await seedTwo();
      const screen = await render(<ProjectBreadcrumb />, { withRouter: true });
      useProjectStore.getState().setMetadata({ title: "Alpha (live)" });
      await expect.element(screen.getByRole("button", { name: "Alpha (live), switch project" })).toBeInTheDocument();
    });
  });
});
