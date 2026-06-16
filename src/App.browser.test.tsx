import { describe, expect, it } from "vitest";
import { App } from "@/App";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";

const bridgeSectionVisible = () => document.querySelector('[data-testid="bridge-section"]') !== null;

describe("App", () => {
  it("renders the app header and tab bar", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(<App />);
    expect(screen.container.textContent).toContain("Composer");
    expect(screen.container.querySelector("nav")).not.toBeNull();
  });

  it("switches the active tab when a tab button is clicked", async () => {
    localStorage.setItem("composer-tour-seen", "true");
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(<App />);
    const editButton = screen.container.querySelector('[data-tour="tab-edit"]') as HTMLButtonElement;
    expect(editButton).not.toBeNull();
    editButton.click();
    expect(useProjectStore.getState().activeTab).toBe("edit");
  });

  it("reopening settings normally resets the section, not stuck on the last highlighted one", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    localStorage.setItem("composer-tour-seen", "true");
    await render(<App />);

    useUIStore.getState().openSettings("bridge-section");
    await expect.poll(bridgeSectionVisible).toBe(true);

    useUIStore.getState().closeSettings();
    await expect.poll(() => document.querySelector("dialog") === null).toBe(true);

    useUIStore.getState().openSettings();
    await expect.poll(() => document.querySelector("dialog") !== null).toBe(true);
    expect(bridgeSectionVisible()).toBe(false);
  });
});
