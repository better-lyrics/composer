import type { BraccatoLyricsElement } from "@braccato/core/element";
import braccatoLyricsCss from "@braccato/core/styles/lyrics.css?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { installStyleSheet, POSITION_UTILITIES_CSS } from "@/test/browser-css";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { buildBackgroundVocalTtml, buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";

// -- Constants -----------------------------------------------------------------

// The browser project has no Tailwind plugin, so the utilities that float the affordance over the
// lyrics are installed by hand next to braccato's own `.blyrics-container` rule, which carries the
// z-index: 1 the affordance has to clear, and next to the scroller rule from src/index.css.
const RESUME_AFFORDANCE_LAYOUT_CSS = [
  braccatoLyricsCss,
  POSITION_UTILITIES_CSS,
  "braccato-lyrics{display:block;overflow-y:auto}",
  ".flex{display:flex}",
  ".flex-col{flex-direction:column}",
  ".flex-1{flex:1 1 0%}",
  ".min-h-0{min-height:0}",
  ".bottom-6{bottom:1.5rem}",
  ".left-1\\/2{left:50%}",
  ".-translate-x-1\\/2{translate:-50% 0}",
  ".z-10{z-index:10}",
].join("\n");

// PreviewPanel hands the renderer a bounded flex column; without one the lyrics run past the
// viewport and the affordance lands where elementFromPoint cannot see it.
const PREVIEW_PANEL_CSS = "display:flex;flex-direction:column;height:600px";

const QUIET_FRAMES_AFTER_CLICK = 6;

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

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
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

    useAudioStore.getState().seekTo(26);
    await expect.poll(() => activeLineText(el)).toContain("third line");
  });

  it("keeps following the clock while the timeline is scrubbed paused", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    useAudioStore.getState().seekTo(26);
    await expect.poll(() => el.currentTime).toBe(26);

    useAudioStore.getState().seekTo(4);
    await expect.poll(() => el.currentTime).toBe(4);
    expect(el.playing).toBe(false);
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
  it("regression #174: stops running frames once the audio is paused and idle", async () => {
    useAudioStore.setState({ audioElement: new Audio(), isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    await waitForLyrics(getBraccatoElement(screen.container));
    await probe.quiesce();

    await settleFrames(probe.count);
    expect(probe.count()).toBe(0);
  });

  it("regression #174: quiesces again once the reader is scrolled back", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    for (let i = 0; i < 5; i++) el.dispatchEvent(new Event("scroll"));
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();

    await screen.getByRole("button", { name: "Resume autoscroll" }).click();
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
    await probe.quiesce();

    await settleFrames(probe.count);
    expect(probe.count()).toBe(0);
  });

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

    useAudioStore.getState().seekTo(5);
    await expect.poll(() => el.currentTime).toBe(5);
  });
});

// -- Regressions ---------------------------------------------------------------

describe("BraccatoRenderer regressions", () => {
  let layoutStyles: HTMLStyleElement | null = null;

  beforeEach(() => {
    layoutStyles = installStyleSheet(RESUME_AFFORDANCE_LAYOUT_CSS);
  });

  afterEach(() => {
    layoutStyles?.remove();
    layoutStyles = null;
  });

  type ResumeAffordance = { screen: Awaited<ReturnType<typeof render>>; button: HTMLElement };

  async function showResumeAffordance(): Promise<ResumeAffordance> {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    screen.container.style.cssText = PREVIEW_PANEL_CSS;
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    for (let i = 0; i < 5; i++) el.dispatchEvent(new Event("scroll"));
    const affordance = screen.getByRole("button", { name: "Resume autoscroll" });
    await expect.element(affordance).toBeInTheDocument();
    return { screen, button: affordance.element() as HTMLElement };
  }

  function topmostAtCentre(element: HTMLElement): Element | null {
    const rect = element.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  it("regression: the resume affordance is the topmost element at its own centre", async () => {
    const { button } = await showResumeAffordance();

    expect(topmostAtCentre(button)?.closest("button")).toBe(button);
  });

  it("regression: a pointer at the resume affordance resumes autoscroll rather than seeking the line beneath", async () => {
    const { screen, button } = await showResumeAffordance();

    topmostAtCentre(button)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await stepFrames(QUIET_FRAMES_AFTER_CLICK);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });
});
