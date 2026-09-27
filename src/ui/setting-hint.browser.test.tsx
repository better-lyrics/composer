import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { SettingHint } from "@/ui/setting-hint";
import { APP_SETTING_LINK_HOST, SettingLinkContext } from "@/ui/setting-link-context";

const HINT = { text: "Try a different cobalt instance in", setting: "cobaltInstances" } as const;

describe("SettingHint", () => {
  it("reads as the hint text followed by the setting link", async () => {
    const screen = await render(
      <SettingLinkContext value={APP_SETTING_LINK_HOST}>
        <SettingHint hint={HINT} />
      </SettingLinkContext>,
    );
    expect(screen.container.textContent).toMatch(/^Try a different cobalt instance in Advanced/);
    await expect.element(screen.getByRole("button", { name: "Open setting Cobalt instances" })).toBeInTheDocument();
  });

  it("opens Settings at the setting from the keyboard", async () => {
    const screen = await render(
      <SettingLinkContext value={APP_SETTING_LINK_HOST}>
        <SettingHint hint={HINT} />
      </SettingLinkContext>,
    );
    (screen.getByRole("button").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useUIStore.getState().settingsTarget).toEqual({ setting: "cobaltInstances" });
  });

  describe("edge cases", () => {
    it("renders as plain text without a link host", async () => {
      const screen = await render(<SettingHint hint={HINT} />);
      expect(screen.container.textContent).toBe("Try a different cobalt instance in Cobalt instances");
      expect(screen.container.querySelector("button")).toBeNull();
    });
  });
});
