import type { BraccatoElement } from "@braccato/core";
import { beforeAll, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { generateTTML } from "@/utils/ttml";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";

// -- Helpers ------------------------------------------------------------------

function buildSyncedTtml(): string {
  const lines = [
    createLine({
      id: "line-a",
      text: "first line here",
      words: [
        { text: "first ", begin: 2, end: 3 },
        { text: "line ", begin: 3, end: 4 },
        { text: "here", begin: 4, end: 6 },
      ],
    }),
    createLine({
      id: "line-b",
      text: "second line now",
      words: [
        { text: "second ", begin: 12, end: 14 },
        { text: "line ", begin: 14, end: 16 },
        { text: "now", begin: 16, end: 18 },
      ],
    }),
    createLine({
      id: "line-c",
      text: "third line ends",
      words: [
        { text: "third ", begin: 24, end: 26 },
        { text: "line ", begin: 26, end: 28 },
        { text: "ends", begin: 28, end: 30 },
      ],
    }),
  ];
  const { metadata, agents } = useProjectStore.getState();
  return generateTTML({ metadata, agents, lines, groups: [], granularity: "word" });
}

function getBraccatoElement(container: Element): BraccatoElement {
  const el = container.querySelector("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  return el as BraccatoElement;
}

async function waitForLyrics(el: BraccatoElement): Promise<void> {
  await expect.poll(() => el.shadowRoot?.querySelectorAll(".braccato--line").length ?? 0).toBeGreaterThan(0);
}

function activeLineText(el: BraccatoElement): string {
  return el.shadowRoot?.querySelector(".braccato--line.braccato--active")?.textContent ?? "";
}

// -- Tests --------------------------------------------------------------------

describe("BraccatoRenderer", () => {
  beforeAll(() => {
    addGlobalAllowedConsolePattern(/dev mode/i);
  });

  it("highlights the line under the current audio time", async () => {
    const ttml = buildSyncedTtml();
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={ttml} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => activeLineText(el)).toContain("second line");
  });

  it("moves the highlight as the audio time advances", async () => {
    const ttml = buildSyncedTtml();
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={ttml} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => activeLineText(el)).toContain("second line");

    audio.currentTime = 26;
    await expect.poll(() => activeLineText(el)).toContain("third line");
  });

  it("starts playback when a line is clicked", async () => {
    const ttml = buildSyncedTtml();
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={ttml} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    el.shadowRoot?.querySelector<HTMLElement>(".braccato--line")?.click();

    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
  });

  it("seeks the audio to the clicked line's start time", async () => {
    const ttml = buildSyncedTtml();
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={ttml} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    el.shadowRoot?.querySelector<HTMLElement>(".braccato--line")?.click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBe(2);
  });
});
