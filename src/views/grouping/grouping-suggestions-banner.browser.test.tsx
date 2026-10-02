import type { LyricLine } from "@/domain/line/model";
import { skippedSharedInstances } from "@/domain/sync/skipped-instances";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { GroupingSuggestionsBanner } from "@/views/grouping/grouping-suggestions-banner";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function twoWordLine(id: string, [first, second]: [string, string], begin: number, secondWordShift = 0) {
  return createLine({
    id,
    text: `${first}${second}`,
    words: [
      createWord({ text: first, begin, end: begin + 1 }),
      createWord({ text: second, begin: begin + 1 + secondWordShift, end: begin + 2 + secondWordShift }),
    ],
  });
}

function lineSynced(id: string, text: string, begin?: number) {
  return createLine({ id, text, ...(begin === undefined ? {} : { begin, end: begin + 2 }) });
}

function chorusLines(prefix: string, begin: number, secondWordShift = 0): LyricLine[] {
  return [
    twoWordLine(`${prefix}-a`, ["go ", "now"], begin, secondWordShift),
    twoWordLine(`${prefix}-b`, ["stay ", "here"], begin + 3),
  ];
}

function bridgeLines(prefix: string, begin: number, secondWordShift = 0): LyricLine[] {
  return [
    twoWordLine(`${prefix}-a`, ["hold ", "on"], begin, secondWordShift),
    twoWordLine(`${prefix}-b`, ["let ", "go"], begin + 3),
  ];
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

async function renderBanner() {
  return render(
    <>
      <GroupingSuggestionsBanner />
      <Toaster />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("GroupingSuggestionsBanner", () => {
  it("renders nothing for an empty project", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<GroupingSuggestionsBanner />);
    expect(screen.container.textContent ?? "").toBe("");
  });
});

describe("GroupingSuggestionsBanner · shared timing in new groups", () => {
  beforeEach(() => {
    useSettingsStore.setState({ shareTimingInNewGroups: true });
    useProjectStore.setState({ lines: [...chorusLines("one", 10), ...chorusLines("two", 40, 0.5)] });
    store().clearHistory();
  });

  it("shares every instance and realigns one with different timing without asking", async () => {
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();

    await expect.poll(() => store().groups.length).toBe(1);
    expect(store().groups[0].sharesTiming).toBe(true);
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
    expect(lineById("two-a")?.words?.[1].begin).toBe(41);
    await expect.element(screen.getByRole("button", { name: "Share anyway" })).not.toBeInTheDocument();
    await expect.element(screen.getByText(/kept (its|their) own timing/)).not.toBeInTheDocument();
  });

  it("regression: shares a partly synced instance mid-sync, so sync skips it", async () => {
    useProjectStore.setState({
      lines: [
        lineSynced("one-a", "go now", 10),
        lineSynced("one-b", "stay here", 13),
        lineSynced("two-a", "go now", 40),
        lineSynced("two-b", "stay here"),
      ],
    });
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();

    await expect.poll(() => store().groups.length).toBe(1);
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
    expect(lineById("two-b")?.begin).toBe(43);
    expect(skippedSharedInstances(store().lines, store().groups).map((skipped) => skipped.lineIds)).toEqual([
      ["two-a", "two-b"],
    ]);
  });

  it("undoes the grouping and the realignment in one step", async () => {
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();
    await expect.poll(() => store().groups.length).toBe(1);

    store().undo();

    expect(store().groups).toEqual([]);
    expect(lineById("two-a")?.groupId).toBeUndefined();
    expect(lineById("two-a")?.words?.[1].begin).toBe(41.5);
  });

  it("shares every group made by Group all", async () => {
    useProjectStore.setState({
      lines: [
        ...chorusLines("one", 10),
        ...chorusLines("two", 40, 0.5),
        ...bridgeLines("three", 60),
        ...bridgeLines("four", 80, 0.5),
      ],
    });
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Review 2" }).click();
    await screen.getByRole("button", { name: "Group all" }).click();

    await expect.poll(() => store().groups.map((group) => group.ownTimingInstances)).toEqual([undefined, undefined]);
    expect(lineById("four-a")?.words?.[1].begin).toBe(81);
  });

  describe("edge cases", () => {
    it("keeps the own timing of an instance that would start before the song and says why", async () => {
      useProjectStore.setState({
        lines: [
          lineSynced("one-a", "go now", 10),
          lineSynced("one-b", "stay here", 13),
          lineSynced("two-a", "go now"),
          lineSynced("two-b", "stay here", 1),
        ],
      });
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Group them" }).click();

      await expect
        .element(screen.getByText("1 instance kept its own timing: the shared timing would start before the song"))
        .toBeInTheDocument();
      expect(store().groups[0].ownTimingInstances).toEqual([1]);
      expect(lineById("two-b")?.begin).toBe(1);
      expect(lineById("two-a")?.begin).toBeUndefined();
      await expect.element(screen.getByRole("button", { name: "Share anyway" })).not.toBeInTheDocument();
    });

    it("keeps the own timing of an instance that differs when no instance is fully synced and says why", async () => {
      useProjectStore.setState({
        lines: [
          twoWordLine("one-a", ["go ", "now"], 10),
          createLine({ id: "one-b", text: "stay here" }),
          twoWordLine("two-a", ["go ", "now"], 40, 0.5),
          createLine({ id: "two-b", text: "stay here" }),
        ],
      });
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Group them" }).click();

      await expect
        .element(screen.getByText("1 instance kept its own timing. Sync one instance fully first."))
        .toBeInTheDocument();
      expect(store().groups[0].ownTimingInstances).toEqual([1]);
      expect(lineById("two-a")?.words?.[1].begin).toBe(41.5);
    });

    it("changes nothing about timing and shows no toast when the setting is off", async () => {
      useSettingsStore.setState({ shareTimingInNewGroups: false });
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Group them" }).click();

      await expect.poll(() => store().groups.length).toBe(1);
      expect(store().groups[0].sharesTiming).toBeUndefined();
      expect(lineById("two-a")?.words?.[1].begin).toBe(41.5);
      await expect.element(screen.getByText(/kept (its|their) own timing/)).not.toBeInTheDocument();
    });
  });
});
