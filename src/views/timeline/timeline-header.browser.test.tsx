import { describe, expect, it } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { render } from "@/test/render";

function seedRomanizedLine() {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
    }),
  ]);
  useProjectStore.getState().setLineRomanizationWithHistory("L1", {
    text: "yoru dakedo",
    wordTexts: ["yoru", "dakedo"],
    source: "generated",
  });
}

function seedPlainLine() {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello", begin: 0, end: 1 },
        { text: "world", begin: 1, end: 2 },
      ],
    }),
  ]);
}

describe("TimelineHeader", () => {
  it("renders the Timeline heading and core toolbar buttons", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Follow/ })).toBeInTheDocument();
  });

  it("toggles followEnabled in the timeline store when the Follow button is clicked", async () => {
    const initial = useTimelineStore.getState().followEnabled;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Follow/ }).click();
    expect(useTimelineStore.getState().followEnabled).toBe(!initial);
  });

  it("does not render the Import button when onImportLyrics is omitted", async () => {
    const screen = await render(<TimelineHeader />);
    const importButton = Array.from(screen.container.querySelectorAll("button")).find((b) =>
      /^Import/i.test(b.textContent ?? ""),
    );
    expect(importButton).toBeUndefined();
  });

  it("invokes onImportLyrics when the Import button is clicked", async () => {
    let clicks = 0;
    const screen = await render(<TimelineHeader onImportLyrics={() => clicks++} />);
    await screen.getByRole("button", { name: /^Import/ }).click();
    expect(clicks).toBe(1);
  });

  it("renders the Rolling button", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("button", { name: /Rolling/ })).toBeInTheDocument();
  });

  it("renders the Rolling button with the ghost variant when rollingEditMode is off", async () => {
    useTimelineStore.setState({ rollingEditMode: false });
    const screen = await render(<TimelineHeader />);
    const rollingButton = screen.container.querySelector("button[title*='Rolling edit']") as HTMLElement;
    expect(rollingButton.className).toContain("opacity-60");
    expect(rollingButton.className).toContain("text-composer-text-muted");
  });

  it("renders the Rolling button with the primary variant when rollingEditMode is on", async () => {
    useTimelineStore.setState({ rollingEditMode: true });
    const screen = await render(<TimelineHeader />);
    const rollingButton = screen.container.querySelector("button[title*='Rolling edit']") as HTMLElement;
    expect(rollingButton.className).not.toContain("opacity-60");
    expect(rollingButton.className).toContain("bg-composer-accent-dark");
  });

  it("toggles rollingEditMode in the timeline store when the Rolling button is clicked", async () => {
    const initial = useTimelineStore.getState().rollingEditMode;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Rolling/ }).click();
    expect(useTimelineStore.getState().rollingEditMode).toBe(!initial);
  });

  it("renders the Snap button", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("button", { name: /Snap/ })).toBeInTheDocument();
  });

  it("toggles settings.timelineSnap when the Snap button is clicked", async () => {
    const initial = useSettingsStore.getState().timelineSnap;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Snap/ }).click();
    expect(useSettingsStore.getState().timelineSnap).toBe(!initial);
  });

  it("dims the Snap button when bypass is active", async () => {
    useTimelineStore.setState({ isBypassing: true });
    const screen = await render(<TimelineHeader />);
    const snapButton = screen.container.querySelector("button[title*='Snap']") as HTMLElement;
    expect(snapButton.className).toContain("opacity-50");
  });
});

describe("TimelineHeader source/romaji toggle", () => {
  it("does not render the toggle when no line has arity-matching wordTexts", async () => {
    seedPlainLine();
    const screen = await render(<TimelineHeader />);
    expect(screen.container.querySelector("[data-testid='timeline-primary-word-text-toggle']")).toBeNull();
  });

  it("renders the toggle when at least one line has arity-matching wordTexts", async () => {
    seedRomanizedLine();
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByTestId("timeline-primary-word-text-toggle")).toBeInTheDocument();
  });

  it("does not render the toggle when wordTexts arity mismatches", async () => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useProjectStore.getState().setLinesWithHistory([
      reconcileLine({
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      }),
    ]);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru",
      wordTexts: ["yoru"],
      source: "generated",
    });
    const screen = await render(<TimelineHeader />);
    expect(screen.container.querySelector("[data-testid='timeline-primary-word-text-toggle']")).toBeNull();
  });

  it("click cycles primaryWordText source -> romaji -> source", async () => {
    seedRomanizedLine();
    useTimelineStore.setState({ primaryWordText: "source" });
    const screen = await render(<TimelineHeader />);
    const toggle = screen.getByTestId("timeline-primary-word-text-toggle");

    await toggle.click();
    expect(useTimelineStore.getState().primaryWordText).toBe("romaji");

    await toggle.click();
    expect(useTimelineStore.getState().primaryWordText).toBe("source");
  });

  it("persists the toggle state in metadata.timelinePrimaryWordText", async () => {
    seedRomanizedLine();
    useTimelineStore.setState({ primaryWordText: "source" });
    const screen = await render(<TimelineHeader />);
    await screen.getByTestId("timeline-primary-word-text-toggle").click();
    expect(useProjectStore.getState().metadata.timelinePrimaryWordText).toBe("romaji");
  });

  it("initialises the toggle from metadata.timelinePrimaryWordText on mount", async () => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useProjectStore.getState().setLinesWithHistory([
      reconcileLine({
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      }),
    ]);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
      source: "generated",
    });
    useProjectStore.getState().setMetadata({ timelinePrimaryWordText: "romaji" });
    const screen = await render(<TimelineHeader />);
    const toggle = screen.getByTestId("timeline-primary-word-text-toggle");
    await expect.element(toggle).toHaveTextContent(/romaji/i);
    expect(useTimelineStore.getState().primaryWordText).toBe("romaji");
  });
});
