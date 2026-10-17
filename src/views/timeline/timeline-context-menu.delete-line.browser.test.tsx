import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go",
    words: [createWord({ text: "go", begin, end: begin + 1 })],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

function seed(group: LinkGroup) {
  useProjectStore.setState({ groups: [group], lines: [chorus(0, 10), chorus(1, 40)] });
  useProjectStore.getState().clearHistory();
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId: "c1", lineIndex: 1 } },
    selectedWords: [],
  });
}

async function deleteLine() {
  const screen = await render(
    <>
      <TimelineContextMenu />
      <Toaster />
    </>,
  );
  await screen.getByRole("button", { name: "Delete line" }).click();
  await expect.poll(() => useProjectStore.getState().lines.map((line) => line.id)).toEqual(["c0"]);
  return screen;
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · delete line", () => {
  it("says the line no longer shares timing when it leaves a shared instance", async () => {
    seed(createGroup({ id: "g1", label: "Chorus", sharesTiming: true }));
    const screen = await deleteLine();

    await expect
      .element(screen.getByText("Line deleted from Chorus 2. Its timing no longer copies there."))
      .toBeVisible();
  });

  describe("edge cases", () => {
    it("stays quiet for a line of an old group", async () => {
      seed(createGroup({ id: "g1", label: "Chorus" }));
      const screen = await deleteLine();

      expect(screen.container.ownerDocument.body.textContent).not.toContain("Line deleted");
    });

    it("stays quiet for a line of an own-timing instance", async () => {
      seed(createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] }));
      const screen = await deleteLine();

      expect(screen.container.ownerDocument.body.textContent).not.toContain("Line deleted");
    });
  });
});
