import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Fixtures -----------------------------------------------------------------

const DARK = "We were dancing in the dark";
const MORNING = "Till the morning came";

function seedProject() {
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", label: "Chorus" })],
    lines: [
      createLine({
        id: "c1",
        text: DARK,
        words: [createWord({ text: DARK, begin: 0, end: 2 })],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      }),
      createLine({
        id: "c2",
        text: MORNING,
        words: [createWord({ text: MORNING, begin: 2.5, end: 4 })],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 1,
      }),
      createLine({
        id: "l3",
        text: "we were dancin in the dark",
        words: [createWord({ text: "we were dancin in the dark", begin: 20, end: 22 })],
      }),
      createLine({
        id: "l4",
        text: "till mornin came",
        words: [createWord({ text: "till mornin came", begin: 22.4, end: 24 })],
      }),
    ],
  });
}

function seedSecondGroup() {
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", label: "Chorus" }), createGroup({ id: "g2", label: "Bridge" })],
    lines: [
      ...useProjectStore.getState().lines,
      createLine({
        id: "b1",
        text: "Hold on",
        words: [createWord({ text: "Hold on", begin: 40, end: 41 })],
        groupId: "g2",
        instanceIdx: 0,
        templateLineIdx: 0,
      }),
      createLine({
        id: "b2",
        text: "Just a while",
        words: [createWord({ text: "Just a while", begin: 41, end: 42 })],
        groupId: "g2",
        instanceIdx: 0,
        templateLineIdx: 1,
      }),
    ],
  });
}

function openGutterMenu(lineIds: string[]) {
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId: lineIds[0], lineIndex: 2 } },
    selectedWords: lineIds.map((lineId, i) => ({ lineId, lineIndex: 2 + i, wordIndex: 0, type: "word" as const })),
  });
}

function renderMenu() {
  return render(
    <>
      <TimelineContextMenu />
      <ConfirmModalHost />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu conform to group", () => {
  beforeEach(() => {
    seedProject();
  });

  it("offers the group when the selection length matches its template", async () => {
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await expect.element(screen.getByRole("button", { name: 'Conform to "Chorus"' })).toBeInTheDocument();
  });

  it("hides the action when the selection length differs from the template", async () => {
    openGutterMenu(["l3"]);
    const screen = await renderMenu();

    await expect.element(screen.getByRole("button", { name: "Add line above" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Conform/ })).not.toBeInTheDocument();
  });

  it("hides the action when a selected line already belongs to a group", async () => {
    useTimelineStore.setState({
      contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId: "c2", lineIndex: 1 } },
      selectedWords: [
        { lineId: "c2", lineIndex: 1, wordIndex: 0, type: "word" },
        { lineId: "l3", lineIndex: 2, wordIndex: 0, type: "word" },
      ],
    });
    const screen = await renderMenu();

    await expect.element(screen.getByRole("button", { name: "Add line above" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Conform/ })).not.toBeInTheDocument();
  });

  it("lists every matching group when more than one qualifies", async () => {
    seedSecondGroup();
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await expect.element(screen.getByRole("button", { name: "Chorus", exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Bridge", exact: true })).toBeInTheDocument();
  });

  it("conforms to the group picked from the list, not the first one", async () => {
    seedSecondGroup();
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await screen.getByRole("button", { name: "Bridge", exact: true }).click();
    await screen.getByRole("button", { name: "Conform", exact: true }).click();

    await expect.poll(() => useProjectStore.getState().lines[2].groupId).toBe("g2");
    const [, , third, fourth] = useProjectStore.getState().lines;
    expect(third.text).toBe("Hold on");
    expect(third.words?.[0].begin).toBe(20);
    expect(fourth.text).toBe("Just a while");
    expect(fourth.instanceIdx).toBe(1);
  });

  it("conforms the selection into a new instance once confirmed", async () => {
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await screen.getByRole("button", { name: 'Conform to "Chorus"' }).click();
    await screen.getByRole("button", { name: "Conform", exact: true }).click();

    await expect.poll(() => useProjectStore.getState().lines[2].groupId).toBe("g1");
    const [, , third, fourth] = useProjectStore.getState().lines;
    expect(third.instanceIdx).toBe(1);
    expect(third.templateLineIdx).toBe(0);
    expect(third.text).toBe(DARK);
    expect(third.words?.[0].begin).toBe(20);
    expect(fourth.instanceIdx).toBe(1);
    expect(fourth.templateLineIdx).toBe(1);
    expect(fourth.text).toBe(MORNING);
    expect(fourth.words?.[0].begin).toBe(22.5);
  });

  it("restores the original lines on undo", async () => {
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await screen.getByRole("button", { name: 'Conform to "Chorus"' }).click();
    await screen.getByRole("button", { name: "Conform", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[2].groupId).toBe("g1");

    useProjectStore.getState().undo();

    const [, , third, fourth] = useProjectStore.getState().lines;
    expect(third.groupId).toBeUndefined();
    expect(third.text).toBe("we were dancin in the dark");
    expect(third.words?.[0].begin).toBe(20);
    expect(fourth.text).toBe("till mornin came");
  });

  it("skips the confirmation when the setting is off", async () => {
    useSettingsStore.setState({ confirmConformToGroup: false });
    openGutterMenu(["l3", "l4"]);
    const screen = await renderMenu();

    await screen.getByRole("button", { name: 'Conform to "Chorus"' }).click();

    await expect.poll(() => useProjectStore.getState().lines[2].groupId).toBe("g1");
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    openGutterMenu(["l3", "l4"]);
    const before = useProjectStore.getState().lines;
    const screen = await renderMenu();

    await screen.getByRole("button", { name: 'Conform to "Chorus"' }).click();
    await screen.getByRole("button", { name: "Cancel" }).click();

    await expect.poll(() => document.querySelector("dialog")).toBeNull();
    expect(useProjectStore.getState().lines).toBe(before);
  });

  it("dismisses the menu on Escape without conforming", async () => {
    openGutterMenu(["l3", "l4"]);
    const before = useProjectStore.getState().lines;
    await renderMenu();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await expect.poll(() => useTimelineStore.getState().contextMenu).toBeNull();
    expect(useProjectStore.getState().lines).toBe(before);
  });
});
