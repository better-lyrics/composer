import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { SettingsSearchInput } from "@/ui/settings/settings-search-input";

const renderInput = () => render(<SettingsSearchInput inputRef={createRef<HTMLInputElement>()} />);

describe("SettingsSearchInput", () => {
  it("writes what is typed to the settings query", async () => {
    const screen = await renderInput();
    await screen.getByRole("textbox", { name: "Search settings" }).fill("snap");
    expect(useUIStore.getState().settingsQuery).toBe("snap");
  });

  it("shows the slash hint only while empty", async () => {
    const screen = await renderInput();
    expect(screen.container.querySelector("kbd")?.textContent).toBe("/");
    useUIStore.getState().setSettingsQuery("snap");
    await expect.poll(() => screen.container.querySelector("kbd")).toBeNull();
  });

  it("clears from the keyboard and returns focus to the field", async () => {
    useUIStore.getState().setSettingsQuery("snap");
    const screen = await renderInput();
    (screen.getByRole("button", { name: "Clear search" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useUIStore.getState().settingsQuery).toBe("");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search settings" }).element());
  });

  describe("edge cases", () => {
    it("keeps whitespace as typed so the caret never jumps", async () => {
      const screen = await renderInput();
      await screen.getByRole("textbox", { name: "Search settings" }).fill("  snap ");
      expect(useUIStore.getState().settingsQuery).toBe("  snap ");
    });
  });
});
