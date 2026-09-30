import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "sonner";
import type { LyricLine } from "@/domain/line/model";
import { GroupingSuggestionsBanner } from "@/views/timeline/grouping-suggestions-banner";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

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

describe("GroupingSuggestionsBanner · instances that kept their own timing", () => {
  beforeEach(() => {
    useSettingsStore.setState({ shareTimingInNewGroups: true });
    useProjectStore.setState({ lines: [...chorusLines("one", 10), ...chorusLines("two", 40, 0.5)] });
  });

  it("offers to share timing when an instance kept its own timing", async () => {
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();

    await expect.element(screen.getByText("1 instance kept its own timing")).toBeInTheDocument();
    expect(store().groups[0].ownTimingInstances).toEqual([1]);
  });

  it("shares every instance when Share anyway is clicked", async () => {
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();
    await screen.getByRole("button", { name: "Share anyway" }).click();

    await expect.poll(() => store().groups[0].ownTimingInstances).toBeUndefined();
    expect(store().groups[0].sharesTiming).toBe(true);
    expect(lineById("two-a")?.words?.[1].begin).toBe(41);
  });

  it("undoes Share anyway in one step", async () => {
    const screen = await renderBanner();
    await screen.getByRole("button", { name: "Group them" }).click();
    await screen.getByRole("button", { name: "Share anyway" }).click();
    await expect.poll(() => store().groups[0].ownTimingInstances).toBeUndefined();

    store().undo();

    expect(store().groups[0].ownTimingInstances).toEqual([1]);
    expect(lineById("two-a")?.words?.[1].begin).toBe(41.5);
  });

  it("offers one toast for every group made by Group all", async () => {
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

    await expect.element(screen.getByText("2 instances kept their own timing")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Share anyway" }).click();
    await expect.poll(() => store().groups.map((group) => group.ownTimingInstances)).toEqual([undefined, undefined]);
  });

  describe("edge cases", () => {
    it("shows no toast when every instance matches", async () => {
      useProjectStore.setState({ lines: [...chorusLines("one", 10), ...chorusLines("two", 40)] });
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Group them" }).click();

      await expect.poll(() => store().groups.length).toBe(1);
      expect(store().groups[0].sharesTiming).toBe(true);
      await expect.element(screen.getByRole("button", { name: "Share anyway" })).not.toBeInTheDocument();
    });

    it("shows no toast when the setting is off", async () => {
      useSettingsStore.setState({ shareTimingInNewGroups: false });
      const screen = await renderBanner();
      await screen.getByRole("button", { name: "Group them" }).click();

      await expect.poll(() => store().groups.length).toBe(1);
      await expect.element(screen.getByRole("button", { name: "Share anyway" })).not.toBeInTheDocument();
    });
  });
});
