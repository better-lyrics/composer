import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const line = (id: string, text: string) => reconcileLine({ id, text, agentId: "v1" });

function songWithTwoChoruses() {
  return [
    line("v1", "Walking down the empty street"),
    line("c1a", "Hold me close tonight"),
    line("c1b", "Never let me go"),
    line("v2", "Morning comes and I am gone"),
    line("c2a", "Hold me close tonight"),
    line("c2b", "Never let me go"),
  ];
}

const store = () => useProjectStore.getState();

// -- Tests --------------------------------------------------------------------

describe("EditPanel · grouping suggestions", () => {
  it("offers to group repeated sections and groups them in one click", async () => {
    useProjectStore.setState({ activeTab: "edit", lines: songWithTwoChoruses(), groups: [] });
    const screen = await render(<EditPanel />);

    await screen.getByRole("button", { name: "Group them" }).click();

    await expect.poll(() => store().groups).toHaveLength(1);
    const grouped = store().lines.filter((candidate) => candidate.groupId !== undefined);
    expect(grouped.map((candidate) => candidate.id)).toEqual(["c1a", "c1b", "c2a", "c2b"]);
    await expect.element(screen.getByRole("button", { name: "Group them" })).not.toBeInTheDocument();
  });

  it("groups with shared timing when new groups share it", async () => {
    useProjectStore.setState({ activeTab: "edit", lines: songWithTwoChoruses(), groups: [] });
    const screen = await render(<EditPanel />);

    await screen.getByRole("button", { name: "Group them" }).click();

    await expect.poll(() => store().groups[0]?.sharesTiming).toBe(true);
  });

  describe("edge cases", () => {
    it("offers nothing when no section repeats", async () => {
      useProjectStore.setState({ activeTab: "edit", lines: songWithTwoChoruses().slice(0, 4), groups: [] });
      const screen = await render(<EditPanel />);

      await expect.element(screen.getByText("Lyrics Editor")).toBeVisible();
      expect(screen.container.textContent).not.toContain("Group them");
    });

    it("keeps a dismissed suggestion hidden", async () => {
      useProjectStore.setState({ activeTab: "edit", lines: songWithTwoChoruses(), groups: [] });
      const screen = await render(<EditPanel />);

      await screen.getByRole("button", { name: "Dismiss suggestion" }).click();

      await expect.element(screen.getByRole("button", { name: "Group them" })).not.toBeInTheDocument();
      expect(store().groups).toEqual([]);
    });
  });
});
