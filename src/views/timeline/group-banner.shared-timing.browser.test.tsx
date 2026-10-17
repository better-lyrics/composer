import { describe, expect, it } from "vitest";
import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { GroupBanner } from "@/views/timeline/group-banner";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useSharedTimingPing } from "@/views/timeline/use-shared-timing-ping";

// -- Fixtures -----------------------------------------------------------------

const GROUP_COLOR_RGB = "rgb(163, 201, 255)";
const TIMING_WRITE = { deriveText: false, propagateToSiblings: false };

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

function seed(group: LinkGroup) {
  useProjectStore.setState({ groups: [group], lines: [chorus(0, 10), chorus(1, 40)] });
}

function Banner({ group, instanceIdx }: { group: LinkGroup; instanceIdx: number }) {
  return (
    <GroupBanner
      group={group}
      instanceIdx={instanceIdx}
      ordinal={instanceIdx + 1}
      totalInstances={2}
      instanceStart={10}
      instanceEnd={12}
      isCollapsed={false}
      zoom={50}
    />
  );
}

function PingingBanner({ group }: { group: LinkGroup }) {
  useSharedTimingPing();
  return <Banner group={group} instanceIdx={1} />;
}

async function linkIconColor(group: LinkGroup, instanceIdx: number): Promise<string> {
  const screen = await render(<Banner group={group} instanceIdx={instanceIdx} />);
  const icon = screen.container.querySelector("svg.tabler-icon-link");
  if (!icon) throw new Error("link icon not rendered");
  return getComputedStyle(icon).color;
}

// -- Tests --------------------------------------------------------------------

describe("GroupBanner · shared timing", () => {
  it("colours the link icon with the group colour for a shared instance", async () => {
    const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true });
    seed(group);

    expect(await linkIconColor(group, 0)).toBe(GROUP_COLOR_RGB);
  });

  it("shows an Own timing chip for an instance with its own timing", async () => {
    const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] });
    seed(group);
    const screen = await render(<Banner group={group} instanceIdx={1} />);

    await expect.element(screen.getByText("Own timing")).toBeVisible();
  });

  it("pings the group when a timing edit is copied to its instances", async () => {
    const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true });
    seed(group);
    await render(<PingingBanner group={group} />);

    const words = (useProjectStore.getState().lines[0].words ?? []).map((word, i) =>
      i === 1 ? { ...word, begin: word.begin + 0.2 } : word,
    );
    useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words } }], TIMING_WRITE);

    await expect.poll(() => useTimelineStore.getState().pingingGroupId).toBe("g1");
  });

  describe("edge cases", () => {
    it("keeps the link icon neutral for an old group", async () => {
      const group = createGroup({ id: "g1", label: "Chorus" });
      seed(group);

      expect(await linkIconColor(group, 0)).not.toBe(GROUP_COLOR_RGB);
    });

    it("keeps the link icon neutral for an instance with its own timing", async () => {
      const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] });
      seed(group);

      expect(await linkIconColor(group, 1)).not.toBe(GROUP_COLOR_RGB);
    });

    it("shows no chip for a shared instance", async () => {
      const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [1] });
      seed(group);
      const screen = await render(<Banner group={group} instanceIdx={0} />);

      await expect.element(screen.getByText("Chorus")).toBeVisible();
      expect(screen.container.textContent).not.toContain("Own timing");
    });

    it("shows no chip for an old group", async () => {
      const group = createGroup({ id: "g1", label: "Chorus" });
      seed(group);
      const screen = await render(<Banner group={group} instanceIdx={1} />);

      await expect.element(screen.getByText("Chorus")).toBeVisible();
      expect(screen.container.textContent).not.toContain("Own timing");
    });

    it("does not ping for an edit in an old group", async () => {
      const group = createGroup({ id: "g1", label: "Chorus" });
      seed(group);
      await render(<PingingBanner group={group} />);

      const words = (useProjectStore.getState().lines[0].words ?? []).map((word, i) =>
        i === 1 ? { ...word, begin: word.begin + 0.2 } : word,
      );
      useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words } }], TIMING_WRITE);

      expect(useProjectStore.getState().lines[0].words?.[1].begin).toBeCloseTo(11.2, 6);
      expect(useTimelineStore.getState().pingingGroupId).toBeNull();
    });
  });

  describe("invariants", () => {
    it("stops pinging once the subscriber unmounts", async () => {
      const group = createGroup({ id: "g1", label: "Chorus", sharesTiming: true });
      seed(group);
      const screen = await render(<PingingBanner group={group} />);
      await screen.unmount();

      const words = (useProjectStore.getState().lines[0].words ?? []).map((word, i) =>
        i === 1 ? { ...word, begin: word.begin + 0.2 } : word,
      );
      useProjectStore.getState().updateLinesWithHistory([{ id: "c0", updates: { words } }], TIMING_WRITE);

      expect(useProjectStore.getState().lines[1].words?.[1].begin).toBeCloseTo(41.2, 6);
      expect(useTimelineStore.getState().pingingGroupId).toBeNull();
    });
  });
});
