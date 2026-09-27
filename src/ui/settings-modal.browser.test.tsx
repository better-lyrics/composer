import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { SettingsModal } from "@/ui/settings-modal";
import { allowConsole } from "@/test/console-guard";
import { installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";

describe("SettingsModal", () => {
  it("renders nothing when isOpen is false", async () => {
    await render(<SettingsModal isOpen={false} onClose={() => {}} onResetTour={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the Settings title and a sidebar of section buttons", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const sectionButtons = document.querySelectorAll("dialog button");
    expect(sectionButtons.length).toBeGreaterThan(5);
  });

  it("switches the visible content when a different section is clicked", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await screen.getByRole("button", { name: /Shortcuts/i }).click();
    expect(document.querySelector("dialog")?.textContent ?? "").toContain("Shortcut");
  });

  it("shows the theme gallery when the Theme section is selected", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await screen.getByRole("button", { name: /Theme/i }).click();
    await expect.element(screen.getByRole("button", { name: /Default/ })).toBeInTheDocument();
  });

  it("invokes onClose when Escape is pressed", async () => {
    let closes = 0;
    await render(<SettingsModal isOpen onClose={() => closes++} onResetTour={() => {}} />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closes).toBeGreaterThan(0);
  });

  describe("section from the store", () => {
    it("opens on the target setting's section", async () => {
      allowConsole(/cannot be a descendant of/);
      allowConsole(/cannot contain a nested/);
      useUIStore.getState().openSettings({ target: { setting: "youtubeBridge" } });
      await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
      expect(document.querySelector('[data-testid="bridge-section"]')).not.toBeNull();
    });

    it("opens on General when there is no target", async () => {
      useUIStore.getState().openSettings();
      await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
      expect(document.querySelector('[data-testid="bridge-section"]')).toBeNull();
    });

    it("writes section changes to the store", async () => {
      const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
      await screen.getByRole("button", { name: /Sync & Timing/ }).click();
      expect(useUIStore.getState().settingsSection).toBe("sync");
    });
  });

  describe("Cobalt instance edit row", () => {
    it("keeps focus on the URL input while typing", async () => {
      allowConsole(/cannot be a descendant of/);
      allowConsole(/cannot contain a nested/);
      useSettingsStore.setState({
        cobaltInstances: [{ id: "test-inst", label: "Self-hosted", url: "https://example.com" }],
        selectedCobaltInstanceId: "test-inst",
      });

      const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
      await screen.getByRole("button", { name: /Advanced/i }).click();
      await screen.getByRole("button", { name: /Self-hosted/i }).click();

      const urlInput = document.querySelector<HTMLInputElement>('dialog input[type="url"]');
      expect(urlInput).not.toBeNull();
      if (!urlInput) throw new Error("URL input not rendered");

      urlInput.focus();
      expect(document.activeElement).toBe(urlInput);

      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      const setValue = (next: string) => {
        nativeSetter?.call(urlInput, next);
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      };

      setValue("https://example.com/a");
      expect(document.activeElement).toBe(urlInput);
      setValue("https://example.com/ab");
      expect(document.activeElement).toBe(urlInput);
      setValue("https://example.com/abc");
      expect(document.activeElement).toBe(urlInput);
      expect(urlInput.value).toBe("https://example.com/abc");
    });
  });
});

describe("SettingsModal target", () => {
  const settingsViewport = () =>
    document.querySelector("[data-settings-content]")?.closest<HTMLElement>("[data-overlayscrollbars-viewport]") ??
    null;
  const row = (id: string) => document.querySelector<HTMLElement>(`[data-setting-id="${id}"]`);

  it("centers the target row and nudges it", async () => {
    installStyleSheet("[data-overlayscrollbars-viewport]{max-height:200px!important;overflow-y:scroll!important}");
    useUIStore.getState().openSettings({ target: { setting: "timelineHorizontalScroll" } });
    await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.poll(() => row("timelineHorizontalScroll")?.hasAttribute("data-nudge")).toBe(true);
    expect(settingsViewport()?.scrollTop ?? 0).toBeGreaterThan(0);
    expect(useUIStore.getState().settingsTarget).toBeNull();
  });

  it("removes the nudge when its animation ends", async () => {
    useUIStore.getState().openSettings({ target: { setting: "followPlayhead" } });
    await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.poll(() => row("followPlayhead")?.hasAttribute("data-nudge")).toBe(true);
    row("followPlayhead")?.dispatchEvent(new AnimationEvent("animationend"));
    expect(row("followPlayhead")?.hasAttribute("data-nudge")).toBe(false);
  });

  it("opens a section target without nudging anything", async () => {
    useUIStore.getState().openSettings({ target: { section: "timeline" } });
    await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.poll(() => useUIStore.getState().settingsTarget).toBeNull();
    expect(document.querySelector("[data-nudge]")).toBeNull();
  });

  it("retargets while already open", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    useUIStore.getState().openSettings();
    await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    useUIStore.getState().openSettings({ target: { setting: "youtubeBridge" } });
    await expect.poll(() => row("youtubeBridge")?.hasAttribute("data-nudge")).toBe(true);
  });

  it("regression: the Try Bridge path lands on the bridge block", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    useUIStore.getState().openSettings({ target: { setting: "youtubeBridge" } });
    await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.poll(() => row("youtubeBridge")?.querySelector('[data-testid="bridge-section"]')).not.toBeNull();
  });
});
