import type { LinkGroup } from "@/domain/group/template";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
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

const unplacedChorus = (instanceIdx: number) =>
  createLine({ id: `c${instanceIdx}`, text: "go now", groupId: "g1", instanceIdx, templateLineIdx: 0 });

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
  it("names the open instance in a toolbar", async () => {
    seed(sharingGroup, 1);
    const screen = await render(<GroupFocusBar />);
    const toolbar = screen.getByRole("toolbar", { name: "Open group" });

    await expect.element(toolbar.getByText("Chorus 2", { exact: true })).toBeVisible();
    expect(document.querySelector("[data-group-focus-bar]")).not.toBeNull();
  });

  it("counts the heard instance among the hearable ones", async () => {
    seed(sharingGroup, 1);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("2 of 2")).toBeVisible();
  });

  it("steps to the next instance and shows its span", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await screen.getByRole("button", { name: "Next instance" }).click();

    expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
    await expect.element(screen.getByText("0:42.50")).toBeVisible();
    await expect.element(screen.getByText("0:44.50")).toBeVisible();
  });

  it("steps to the previous instance, wrapping around", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await screen.getByRole("button", { name: "Previous instance" }).click();

    expect(focus()?.hearInstanceIdx).toBe(1);
  });

  it("keeps the playhead at the same moment when stepping", async () => {
    seed(sharingGroup, 0);
    useAudioStore.getState().seekTo(10.5);
    const screen = await render(<GroupFocusBar />);

    await screen.getByRole("button", { name: "Next instance" }).click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBeCloseTo(43);
  });

  it("steps from the keyboard", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    (screen.getByRole("button", { name: "Next instance" }).element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");

    expect(focus()?.hearInstanceIdx).toBe(1);
  });

  it("shows a shared instance's span and counts the instances with own timing", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText(/^Shared/)).toBeVisible();
    await expect.element(screen.getByText("0:10.00")).toBeVisible();
    await expect.element(screen.getByText("0:12.00")).toBeVisible();
    await expect.element(screen.getByText("· 1 own timing")).toBeVisible();
  });

  it("counts shared instances with no timing as not placed", async () => {
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
      lines: [chorus(0, 10), chorus(1, 40), unplacedChorus(2)],
    });
    useTimelineStore.getState().openGroup("g1", 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("1 of 2")).toBeVisible();
    await expect.element(screen.getByText("· 1 not placed")).toBeVisible();
    await expect.element(screen.getByText(/own timing/)).not.toBeInTheDocument();
  });

  it("toggles Loop and shows it pressed", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);
    const loop = screen.getByRole("button", { name: "Loop" });

    await expect.element(loop).toHaveAttribute("aria-pressed", "false");
    await loop.click();

    expect(useSettingsStore.getState().loopOpenGroup).toBe(true);
    await expect.element(loop).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the group with Done and shows the close shortcut", async () => {
    seed(sharingGroup, 0);
    const screen = await render(<GroupFocusBar />);

    await expect.element(screen.getByText("Esc")).toBeVisible();
    await screen.getByRole("button", { name: /^Done/ }).click();

    expect(focus()).toBeNull();
  });

  describe("own timing", () => {
    it("says the instance has own timing, with Share timing in place of the stepper", async () => {
      seed(sharingGroup, 2);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByText("Own timing")).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Next instance" })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Share timing" }).click();

      await expect.poll(() => store().groups[0].ownTimingInstances).toBeUndefined();
      await expect.element(screen.getByRole("button", { name: "Next instance" })).toBeVisible();
      await expect.element(screen.getByText("3 of 3")).toBeVisible();
    });

    it("does not count the opened own-timing instance among the others", async () => {
      seed(sharingGroup, 2);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByText("Own timing")).toBeVisible();
      await expect.element(screen.getByText(/· \d+ own timing/)).not.toBeInTheDocument();
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

    it("disables the stepper when only one instance can be heard", async () => {
      useProjectStore.setState({
        groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] })],
        lines: [chorus(0, 10), chorus(1, 40)],
      });
      useTimelineStore.getState().openGroup("g1", 0);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByText("1 of 1")).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Previous instance" })).toBeDisabled();
      await expect.element(screen.getByRole("button", { name: "Next instance" })).toBeDisabled();
    });

    it("counts every instance when the open one has no timing yet", async () => {
      useProjectStore.setState({
        groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
        lines: [chorus(0, 10), chorus(1, 40), unplacedChorus(2)],
      });
      useTimelineStore.getState().openGroup("g1", 2);
      const screen = await render(<GroupFocusBar />);

      await expect.element(screen.getByText("3 of 3")).toBeVisible();
      await expect.element(screen.getByText("Shared · not placed")).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Next instance" })).toBeDisabled();
    });
  });

  describe("invariants", () => {
    it("never changes lyrics or timing by stepping or looping", async () => {
      seed(sharingGroup, 0);
      const before = store().lines;
      const screen = await render(<GroupFocusBar />);

      await screen.getByRole("button", { name: "Next instance" }).click();
      await screen.getByRole("button", { name: "Loop" }).click();

      expect(store().lines).toBe(before);
    });
  });
});
