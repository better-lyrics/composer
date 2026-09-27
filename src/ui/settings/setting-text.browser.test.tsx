import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { SettingText } from "@/ui/settings/setting-text";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";

const marks = (container: HTMLElement) => [...container.querySelectorAll("mark")].map((mark) => mark.textContent);

describe("SettingText", () => {
  it("shows the catalog label and description", async () => {
    const screen = await render(<SettingText id="followPlayhead" />);
    await expect.element(screen.getByText("Follow playhead")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Auto-scroll the timeline to keep the playhead visible."))
      .toBeInTheDocument();
  });

  it("highlights the search query in the label and the description", async () => {
    const screen = await render(
      <SettingsSearchQueryContext value="playhead">
        <SettingText id="followPlayhead" />
      </SettingsSearchQueryContext>,
    );
    expect(marks(screen.container)).toEqual(["playhead", "playhead"]);
  });

  describe("edge cases", () => {
    it("marks nothing without a query", async () => {
      const screen = await render(<SettingText id="followPlayhead" />);
      expect(marks(screen.container)).toEqual([]);
    });
  });
});
