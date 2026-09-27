import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";

describe("SettingsSectionRows (advanced)", () => {
  it("renders the preview renderer select and the built-in Cobalt instance", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    const screen = await render(<SettingsSectionRows section="advanced" />);
    await expect.element(screen.getByRole("button", { name: "Preview renderer" })).toBeInTheDocument();
    await expect.element(screen.getByText("Composer", { exact: true })).toBeInTheDocument();
  });

  it("updates the preview renderer setting from the select", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    useSettingsStore.setState({ previewRenderer: "braccato" });
    const screen = await render(<SettingsSectionRows section="advanced" />);
    await screen.getByRole("button", { name: "Preview renderer" }).click();
    await screen.getByRole("option", { name: "am-lyrics" }).click();
    await expect.poll(() => useSettingsStore.getState().previewRenderer).toBe("am-lyrics");
  });

  it("adds a Cobalt instance through the add form", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    const screen = await render(<SettingsSectionRows section="advanced" />);
    await screen.getByPlaceholder("Name").fill("My Box");
    await screen.getByPlaceholder(/your-cobalt-instance/).fill("https://cobalt.example.com");
    await screen.getByRole("button", { name: "Add" }).click();
    await expect.poll(() => useSettingsStore.getState().cobaltInstances.length).toBe(1);
    await expect.poll(() => useSettingsStore.getState().cobaltInstances[0]?.label).toBe("My Box");
  });
});
