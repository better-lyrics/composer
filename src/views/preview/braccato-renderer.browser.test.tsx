import type { BraccatoLyricsElement } from "@braccato/core/element";
import { afterEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";
import { buildBackgroundVocalTtml, buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";

// -- Helpers ------------------------------------------------------------------

function getBraccatoElement(container: Element): BraccatoLyricsElement {
  const el = container.querySelector("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  return el as BraccatoLyricsElement;
}

async function waitForLyrics(el: BraccatoLyricsElement): Promise<void> {
  await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
}

function activeLineText(el: BraccatoLyricsElement): string {
  return el.querySelector(".blyrics--line.blyrics--active")?.textContent ?? "";
}

function lineTexts(el: BraccatoLyricsElement): string[] {
  return [...el.querySelectorAll(".blyrics--line")].map((line) => line.textContent ?? "");
}

afterEach(() => {
  for (const el of document.querySelectorAll("#composer-audio")) {
    el.remove();
  }
});

// -- Tests --------------------------------------------------------------------

describe("BraccatoRenderer", () => {
  it("highlights the line under the current audio time", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => activeLineText(el)).toContain("second line");
  });

  it("moves the highlight as the audio time advances", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => activeLineText(el)).toContain("second line");

    audio.currentTime = 26;
    await expect.poll(() => activeLineText(el)).toContain("third line");
  });

  it("tracks a newly registered audio element", async () => {
    const firstAudio = new Audio();
    firstAudio.currentTime = 14;
    useAudioStore.setState({ audioElement: firstAudio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => activeLineText(el)).toContain("second line");

    const replacementAudio = new Audio();
    replacementAudio.currentTime = 26;
    useAudioStore.setState({ audioElement: replacementAudio });

    await expect.poll(() => activeLineText(el)).toContain("third line");
  });

  it("drives the element clock in seconds, not milliseconds", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.currentTime).toBe(14);
  });

  it("reports the audio play state to the element", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.playing).toBe(false);
  });

  it("hands the playback rate over so word sweeps follow the song rather than the wall clock", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    audio.playbackRate = 0.25;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.tickOptions.playbackRate).toBe(0.25);

    audio.playbackRate = 2;

    await expect.poll(() => el.tickOptions.playbackRate).toBe(2);
  });

  it("starts playback when a line is clicked", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    el.querySelector<HTMLElement>(".blyrics--line")?.click();

    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
  });

  it("seeks the audio to the clicked line's start time in seconds", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    el.querySelector<HTMLElement>(".blyrics--line")?.click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBe(2);
  });

  it("never binds a media source, leaving the composer clock authoritative", async () => {
    const audio = new Audio();
    audio.id = "composer-audio";
    document.body.appendChild(audio);
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    expect(el.source).toBeNull();
    expect(el.mediaElement).toBeNull();
  });

  it("renders background vocals on their own line, marked apart from the main vocal", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.querySelectorAll(".blyrics-background-line").length).toBe(1);
    const backgroundLine = el.querySelector(".blyrics-background-line");
    expect(backgroundLine?.textContent).toContain("ooh");
    expect(backgroundLine?.textContent).toContain("ahh");
    expect(el.querySelector(".blyrics-line-main")?.textContent).not.toContain("ooh");

    const backgroundWords = [...el.querySelectorAll(".blyrics--word.blyrics-background-lyric")];
    expect(backgroundWords.map((word) => word.textContent)).toEqual(["ooh", "ahh"]);
  });

  it("applies the composer theme, keeping its scroll ratio and long-word glow", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    expect(el.theme).toContain("blyrics-target-scroll-pos-ratio");
    expect(el.theme).toContain("data-long-word");
    expect(el.theme).not.toContain("--blyrics-font-family:");
    expect(el.theme).not.toContain("--blyrics-font-size:");

    const themeElement = document.getElementById("blyrics-custom-style");
    expect(themeElement).not.toBeNull();
    expect(el.status).toBe("rendering");
  });

  it("offers a way back when the reader scrolls away, and takes it away on resume", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();

    for (let i = 0; i < 5; i++) el.dispatchEvent(new Event("scroll"));

    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();

    await screen.getByRole("button", { name: "Resume autoscroll" }).click();

    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("BraccatoRenderer edge cases", () => {
  it("fills silence between lines with instrumental lines", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.filter((lyric) => lyric.isInstrumental).length).toBe(2);
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBe(5);
  });

  it("fills trailing silence with an outro instrumental when the document carries a duration", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml(45)} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.filter((lyric) => lyric.isInstrumental).length).toBe(3);
    const outro = el.lyrics?.at(-1);
    expect(outro?.isInstrumental).toBe(true);
    expect(outro?.startTimeMs).toBe(30_000);
  });

  it("adds no outro instrumental when the document carries no duration", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.at(-1)?.words).toBe("third line ends");
    expect(el.lyrics?.at(-1)?.isInstrumental).toBeUndefined();
  });

  it("renders nothing and does not throw for lyrics with no timing", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString="<tt></tt>" />);
    const el = getBraccatoElement(screen.container);

    await expect.poll(() => el.lyrics).toEqual([]);
    expect(el.querySelectorAll(".blyrics--line")).toHaveLength(0);
  });
});

// -- Invariants ---------------------------------------------------------------

describe("BraccatoRenderer invariants", () => {
  it("updates lyrics in place rather than recreating the element", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    expect(lineTexts(el).join(" ")).toContain("second line");

    await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);

    await expect.poll(() => lineTexts(el).join(" ")).toContain("ooh");
    expect(getBraccatoElement(screen.container)).toBe(el);
  });

  it("keeps the element clock following the audio across lyric changes", async () => {
    const audio = new Audio();
    audio.currentTime = 26;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);

    audio.currentTime = 5;
    await expect.poll(() => el.currentTime).toBe(5);
  });
});
