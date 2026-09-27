import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { DEFAULT_COBALT_INSTANCE_ID, useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { CobaltInstancesSetting } from "@/ui/settings/cobalt-instances-setting";

const CUSTOM = { id: "self", label: "Self-hosted", url: "https://cobalt.example.com" };

describe("CobaltInstancesSetting", () => {
  it("shows the catalog label and the built-in instance", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    const screen = await render(<CobaltInstancesSetting />);
    await expect.element(screen.getByText("Cobalt instances")).toBeInTheDocument();
    await expect.element(screen.getByText("Composer", { exact: true })).toBeInTheDocument();
  });

  it("adds an instance through the form", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    const screen = await render(<CobaltInstancesSetting />);
    await screen.getByPlaceholder("Name").fill("My Box");
    await screen.getByPlaceholder(/your-cobalt-instance/).fill("https://cobalt.example.com");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useSettingsStore.getState().cobaltInstances[0]?.label).toBe("My Box");
  });

  it("selects a custom instance from the keyboard", async () => {
    allowConsole(/cannot be a descendant of/);
    allowConsole(/cannot contain a nested/);
    useSettingsStore.setState({ cobaltInstances: [CUSTOM], selectedCobaltInstanceId: DEFAULT_COBALT_INSTANCE_ID });
    const screen = await render(<CobaltInstancesSetting />);
    (screen.getByRole("button", { name: /Self-hosted/ }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useSettingsStore.getState().selectedCobaltInstanceId).toBe("self");
  });
});
