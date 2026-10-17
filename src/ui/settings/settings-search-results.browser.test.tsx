import { DEFAULTS, type SettingsState, useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { searchSettings } from "@/ui/settings/search-settings";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { SettingsSearchResults } from "@/ui/settings/settings-search-results";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

function renderResults(query: string, state: SettingsState = DEFAULTS) {
  const results = searchSettings(query, state);
  if (!results) throw new Error(`expected results for "${query}"`);
  return render(
    <SettingsSearchQueryContext value={query}>
      <SettingsSearchResults results={results} />
    </SettingsSearchQueryContext>,
  );
}

describe("SettingsSearchResults", () => {
  it("groups matching rows under their section in section order", async () => {
    const screen = await renderResults("preview");
    const headings = [...screen.container.querySelectorAll("h3")].map((heading) => heading.textContent);
    expect(headings).toEqual(["Playback", "Timeline", "Shortcuts", "Advanced"]);
  });

  it("renders live controls that write to the store", async () => {
    useSettingsStore.setState({ followPlayhead: true });
    const screen = await renderResults("follow playhead");
    await screen.getByRole("switch", { name: "Follow playhead" }).click();
    expect(useSettingsStore.getState().followPlayhead).toBe(false);
  });

  it("lists matching shortcuts under Shortcuts", async () => {
    const screen = await renderResults("toggle snap");
    await expect.element(screen.getByRole("region", { name: "Shortcuts" })).toBeInTheDocument();
    await expect.element(screen.getByText("Toggle snap (magnet)")).toBeInTheDocument();
  });

  it("opens a group's section from the keyboard and leaves search", async () => {
    useUIStore.getState().setSettingsQuery("snap");
    const screen = await renderResults("snap");
    (screen.getByRole("button", { name: "Open Timeline section" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useUIStore.getState()).toMatchObject({ settingsSection: "timeline", settingsQuery: "" });
  });

  describe("edge cases", () => {
    it("shows no matches with the trimmed query and a clear action", async () => {
      useUIStore.getState().setSettingsQuery("  zzzqqq ");
      const screen = await renderResults("  zzzqqq ");
      await expect.element(screen.getByRole("status")).toHaveTextContent('No settings match "zzzqqq"');
      await screen.getByRole("button", { name: "Clear search" }).click();
      expect(useUIStore.getState().settingsQuery).toBe("");
    });

    it("renders exactly what the search owner already filtered for visibility (positive control)", async () => {
      const hidden = await renderResults("quota limit", { ...DEFAULTS, smartCleanup: false });
      expect(hidden.getByRole("button", { name: "Storage limit" }).elements()).toHaveLength(0);
      await expect.element(hidden.getByRole("status")).toHaveTextContent('No settings match "quota limit"');

      const visible = await renderResults("quota limit", { ...DEFAULTS, smartCleanup: true });
      await expect.element(visible.getByRole("button", { name: "Storage limit" })).toBeInTheDocument();
    });
  });
});
