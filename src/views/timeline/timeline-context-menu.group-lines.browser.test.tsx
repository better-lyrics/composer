import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function groupTwoLines() {
  useProjectStore.setState({ lines: [createLine({ id: "a", text: "one" }), createLine({ id: "b", text: "two" })] });
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId: "b", lineIndex: 1 } },
    selectedWords: [{ lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }],
  });
  const screen = await render(
    <>
      <TimelineContextMenu />
      <Toaster />
    </>,
  );
  await screen.getByRole("button", { name: "Group 2 lines" }).click();
  await expect.element(screen.getByText("Grouped 2 lines")).toBeVisible();
  return screen;
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · group lines", () => {
  it("says that the new group shares its timing", async () => {
    const screen = await groupTwoLines();

    await expect.element(screen.getByText("Instances of this group share their timing")).toBeVisible();
  });

  describe("edge cases", () => {
    it("says nothing about timing when new groups do not share it", async () => {
      useSettingsStore.setState({ shareTimingInNewGroups: false });
      const screen = await groupTwoLines();

      expect(screen.container.ownerDocument.body.textContent).not.toContain("share their timing");
    });
  });
});
