import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { SyncSection } from "@/ui/settings/sync-section";

describe("SyncSection", () => {
  it("renders the split character control, sliders, and granularity select", async () => {
    const screen = await render(<SyncSection />);
    await expect.element(screen.getByText("Split character")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Default granularity" })).toBeInTheDocument();
    expect(screen.container.querySelectorAll('input[type="range"]').length).toBe(3);
  });

  it("updates the default granularity from the select", async () => {
    useSettingsStore.setState({ defaultGranularity: "word" });
    const screen = await render(<SyncSection />);
    await screen.getByRole("button", { name: "Default granularity" }).click();
    await screen.getByRole("option", { name: "Line" }).click();
    await expect.poll(() => useSettingsStore.getState().defaultGranularity).toBe("line");
  });
});
