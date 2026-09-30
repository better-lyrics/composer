import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { GroupFocusBar } from "@/views/timeline/group-focus-bar";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const sharingGroup = createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [2] });

function seed(group: LinkGroup, hearInstanceIdx: number) {
  useProjectStore.setState({ groups: [group], lines: [chorus(0, 10), chorus(1, 42.5), chorus(2, 70)] });
  useProjectStore.getState().clearHistory();
  useTimelineStore.getState().openGroup(group.id, hearInstanceIdx);
}

const store = () => useProjectStore.getState();
const focus = () => useTimelineStore.getState().focusedGroup;

// -- Tests --------------------------------------------------------------------

describe("GroupFocusBar", () => {
  it("names the group and counts its shared instances", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("Chorus", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("· 2 shared instances")).toBeVisible();
  });

  it("closes the group from the Song crumb", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await screen.getByRole("button", { name: "Song" }).click();

    expect(focus()).toBeNull();
  });

  it("lists every instance by name in the Hear switch, with the heard one pressed", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);
    const hear = screen.getByRole("group", { name: "Hear" });

    await expect.element(hear.getByRole("button", { name: "Chorus 1" })).toHaveAttribute("aria-pressed", "true");
    await expect.element(hear.getByRole("button", { name: "Chorus 2" })).toHaveAttribute("aria-pressed", "false");
    await expect.element(hear.getByRole("button", { name: "Chorus 3" })).toBeDisabled();
  });

  it("switches the heard instance and shows its start time", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await screen.getByRole("button", { name: "Chorus 2" }).click();

    expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
    await expect.element(screen.getByText("0:42.50")).toBeVisible();
  });

  it("switches the heard instance from the keyboard", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    (screen.getByRole("button", { name: "Chorus 2" }).element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");

    expect(focus()?.hearInstanceIdx).toBe(1);
  });

  it("shows the close shortcut", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("Esc")).toBeVisible();
  });

  it("lists instances with own timing as not included, with a way to share them", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("Not included:")).toBeVisible();
    await expect.element(screen.getByText("Chorus 3 (own timing)")).toBeVisible();
    await screen.getByRole("button", { name: "Share timing" }).click();

    await expect.poll(() => store().groups[0].ownTimingInstances).toBeUndefined();
    await expect.element(screen.getByText("Not included:")).not.toBeInTheDocument();
  });

  describe("own timing", () => {
    it("opens only the own-timing instance, with Share timing in place of the Hear switch", async () => {
      seed(sharingGroup, 2);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByRole("group", { name: "Hear" })).not.toBeInTheDocument();
      await expect.element(screen.getByText("1:10.00")).toBeVisible();
      await screen.getByRole("button", { name: "Share timing" }).click();

      await expect.poll(() => store().groups[0].ownTimingInstances).toBeUndefined();
      await expect.element(screen.getByRole("group", { name: "Hear" })).toBeVisible();
    });

    it("does not list the opened own-timing instance as not included", async () => {
      seed(sharingGroup, 2);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByText("Not included:")).not.toBeInTheDocument();
    });

    it("offers to share timing across an older group", async () => {
      seed(createGroup({ id: "g1", label: "Chorus" }), 0);
      const screen = await render(<GroupFocusBar />);

      await screen.getByRole("button", { name: "Share timing across group" }).click();

      await expect.poll(() => store().groups[0].sharesTiming).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("renders nothing when no group is open", async () => {
      useProjectStore.setState({ groups: [sharingGroup], lines: [chorus(0, 10)] });
      const screen = await render(<GroupFocusBar />);

      expect(screen.container.textContent).toBe("");
    });

    it("renders nothing when the open group no longer exists", async () => {
      seed(sharingGroup, 0);
      useProjectStore.setState({ groups: [] });
      const screen = await render(<GroupFocusBar />);

      expect(screen.container.textContent).toBe("");
    });
  });

  describe("invariants", () => {
    it("never changes lyrics or timing by switching the heard instance", async () => {
      seed(sharingGroup, 0);
      const before = store().lines;
      const screen = await render(<GroupFocusBar />);

      await screen.getByRole("button", { name: "Chorus 2" }).click();

      expect(store().lines).toBe(before);
    });
  });
});
