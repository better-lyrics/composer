import { describe, expect, it } from "vitest";
import { App } from "@/App";
import { subscribeFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { allowConsole } from "@/test/console-guard";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TOUR_SEEN_KEY } from "@/tour/use-tour";

const bridgeSectionVisible = () => document.querySelector('[data-testid="bridge-section"]') !== null;

const helpButton = () => document.querySelector('button[title^="Keyboard shortcuts"]') as HTMLButtonElement;

const HELP_NAV_LABELS = ["Getting Started", "Best practices", "Exporting", "Timeline"];

const helpNav = () => [...(document.querySelector("dialog")?.querySelectorAll("button") ?? [])];

const helpNavButton = (label: string) => helpNav().find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

const activeHelpSection = () =>
  helpNav()
    .find((b) => b.classList.contains("bg-composer-button") && HELP_NAV_LABELS.includes(b.textContent?.trim() ?? ""))
    ?.textContent?.trim() ?? "";

const helpModalOpen = () => document.querySelector("[data-help-content]") !== null;

describe("App", () => {
  it("renders the app header and tab bar", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(<App />);
    expect(screen.container.textContent).toContain("Composer");
    expect(screen.container.querySelector("nav")).not.toBeNull();
  });

  it("switches the active tab when a tab button is clicked", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
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
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    await render(<App />);

    useUIStore.getState().openSettings("bridge-section");
    await expect.poll(bridgeSectionVisible).toBe(true);

    useUIStore.getState().closeSettings();
    await expect.poll(() => document.querySelector("dialog") === null).toBe(true);

    useUIStore.getState().openSettings();
    await expect.poll(() => document.querySelector("dialog") !== null).toBe(true);
    expect(bridgeSectionVisible()).toBe(false);
  });

  it("regression: reopening help resets the section instead of restoring the last one viewed", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    await render(<App />);

    helpButton().click();
    await expect.poll(helpModalOpen).toBe(true);
    expect(activeHelpSection()).toBe("Getting Started");

    helpNavButton("Exporting").click();
    await expect.poll(activeHelpSection).toBe("Exporting");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect.poll(helpModalOpen).toBe(false);

    helpButton().click();
    await expect.poll(helpModalOpen).toBe(true);
    expect(activeHelpSection()).toBe("Getting Started");
  });

  it("wires the frame loop so a store write wakes it", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    await render(<App />);

    let frames = 0;
    const unsubscribe = subscribeFrame(() => {
      frames += 1;
    }, "app-wiring-probe");
    await settleFrames(() => frames);
    frames = 0;
    useProjectStore.setState({ activeTab: "edit" });
    await settleFrames(() => frames);
    unsubscribe();

    expect(frames).toBeGreaterThan(0);
  });
});
