import { useSettingsStore } from "@/stores/settings";
import { SETTINGS_SECTIONS, settingIdsInSection } from "@/stores/settings-catalog";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { describe, expect, it } from "vitest";

const renderedIds = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[data-setting-id]")].map((row) => row.dataset.settingId);

describe("SettingsSectionRows", () => {
  for (const { id: section } of SETTINGS_SECTIONS.filter(({ id }) => id !== "shortcuts")) {
    it(`renders exactly the ${section} catalog rows in catalog order`, async () => {
      allowConsole(/cannot be a descendant of/);
      allowConsole(/cannot contain a nested/);
      const screen = await render(<SettingsSectionRows section={section} />);
      expect(renderedIds(screen.container)).toEqual(settingIdsInSection(section));
    });
  }

  describe("regressions", () => {
    it("regression: exposes a switch for the group deletion prompt", async () => {
      const screen = await render(<SettingsSectionRows section="confirmations" />);
      await screen.getByRole("switch", { name: "Confirm deleting a group" }).click();
      await expect.poll(() => useSettingsStore.getState().confirmGroupDissolution).toBe(false);
    });
  });

  describe("invariants", () => {
    it("renders a section with no grouped rows without wrapping anything in a region", async () => {
      const screen = await render(<SettingsSectionRows section="playback" />);
      expect(screen.getByRole("region").elements()).toHaveLength(0);
    });
  });
});
