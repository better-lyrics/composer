import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { untilDialogFocused } from "@/test/dialog-focus";
import { render } from "@/test/render";
import { SettingsModal } from "@/ui/settings-modal";
import { describe, expect, it } from "vitest";

describe("SettingsModal Changed", () => {
  it("lists a changed setting under Changed and opens its section", async () => {
    useSettingsStore.setState({ followPlayhead: false });
    const screen = await render(<SettingsModal isOpen onClose={() => {}} />);
    await untilDialogFocused();
    await screen.getByRole("button", { name: /^Changed\s*\d+$/ }).click();
    await expect.element(screen.getByText("Follow playhead")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Open Timeline section" }).click();
    expect(useUIStore.getState().settingsSection).toBe("timeline");
  });
});
