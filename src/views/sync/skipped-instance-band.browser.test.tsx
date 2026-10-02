import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useProjectStore } from "@/stores/project";
import { createGroup } from "@/test/factories";
import { render } from "@/test/render";
import { SkippedInstanceBand } from "@/views/sync/skipped-instance-band";

// -- Helpers ------------------------------------------------------------------

function renderBand(onJumpToLine: (lineIndex: number) => void = () => {}) {
  useProjectStore.setState({ groups: [createGroup({ id: "g1", sharesTiming: true })] });
  return render(
    <SkippedInstanceBand
      groupId="g1"
      instanceIdx={1}
      firstLineIndex={3}
      skippedCount={2}
      color="#ff0000"
      onJumpToLine={onJumpToLine}
    />,
  );
}

// -- Tests --------------------------------------------------------------------

describe("SkippedInstanceBand", () => {
  it("shows how many lines were skipped", async () => {
    const screen = await renderBand();
    await expect.element(screen.getByText("2 skipped")).toBeInTheDocument();
  });

  it("gives the instance its own timing and jumps to its first line on Sync anyway", async () => {
    const jumps: number[] = [];
    const screen = await renderBand((lineIndex) => jumps.push(lineIndex));
    await screen.getByRole("button", { name: "Sync anyway" }).click();
    expect(useProjectStore.getState().groups[0].ownTimingInstances).toEqual([1]);
    expect(jumps).toEqual([3]);
  });

  it("runs Sync anyway from the keyboard", async () => {
    const jumps: number[] = [];
    const screen = await renderBand((lineIndex) => jumps.push(lineIndex));
    await userEvent.tab();
    await expect.element(screen.getByRole("button", { name: "Sync anyway" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => jumps).toEqual([3]);
  });

  describe("invariants", () => {
    it("makes Sync anyway one undo step", async () => {
      const screen = await renderBand();
      await screen.getByRole("button", { name: "Sync anyway" }).click();
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().groups[0].ownTimingInstances).toBeUndefined();
    });
  });
});
