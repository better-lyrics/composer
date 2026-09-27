import { IconLayoutRows } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { SearchResultGroupHeader } from "@/ui/search-result-group-header";

describe("SearchResultGroupHeader", () => {
  it("names the group with a level 3 heading", async () => {
    const screen = await render(
      <SearchResultGroupHeader icon={IconLayoutRows} label="Timeline" onOpenSection={() => {}} />,
    );
    await expect.element(screen.getByRole("heading", { name: "Timeline", level: 3 })).toBeInTheDocument();
  });

  it("opens the section from the keyboard", async () => {
    let opened = 0;
    const screen = await render(
      <SearchResultGroupHeader icon={IconLayoutRows} label="Timeline" onOpenSection={() => opened++} />,
    );
    (screen.getByRole("button", { name: "Open Timeline section" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toBe(1);
  });

  describe("invariants", () => {
    it("is excluded from search text", async () => {
      const screen = await render(
        <SearchResultGroupHeader icon={IconLayoutRows} label="Timeline" onOpenSection={() => {}} />,
      );
      expect(screen.container.querySelector("[data-search-ignore]")).not.toBeNull();
    });
  });
});
