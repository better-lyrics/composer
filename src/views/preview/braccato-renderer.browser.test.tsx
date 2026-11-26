import { holdFrames } from "@/lib/frame-loop";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { POSITION_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { isWordLit, litLineText } from "@/test/braccato-canvas";
import { type FrameProbe, createFrameProbe } from "@/test/frame-probe";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildShortWordTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import type { RendererPlayback } from "@/views/preview/renderer-playback";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import braccatoLyricsCss from "@braccato/core/styles/lyrics.css?raw";
import braccatoVariablesCss from "@braccato/core/styles/variables.css?raw";
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from "vitest";

// -- Constants -----------------------------------------------------------------

// The browser project has no Tailwind plugin, so the utilities that float the affordance over the
// lyrics are installed by hand. Motion owns the affordance transform, so without the absolute box to
// shrink-wrap it the centring `-50%` would drag it half the page width off screen.
const AFFORDANCE_POSITION_CSS = [
  POSITION_UTILITIES_CSS,
  ".bottom-6{bottom:1.5rem}",
  ".left-1\\/2{left:50%}",
  ".z-10{z-index:10}",
].join("\n");

// The app loads braccato's variables, which carry the highlight leads the preview trims while paused.
// Braccato's own `.blyrics-container` rule carries the z-index: 1 the affordance has to clear, and
// the scroller rule comes from src/index.css. PreviewPanel bounds the scroller; without that the
// lyrics run past the viewport, nothing scrolls, and the affordance lands where elementFromPoint
// cannot see it. Braccato measures the scroller as it builds, so it is bounded from the start.
const RESUME_AFFORDANCE_LAYOUT_CSS = [
  braccatoVariablesCss,
  braccatoLyricsCss,
  AFFORDANCE_POSITION_CSS,
  "[data-lyrics-layout]{height:600px}",
  "braccato-lyrics{display:block;overflow-y:auto}",
  ".flex{display:flex}",
  ".flex-col{flex-direction:column}",
  ".flex-1{flex:1 1 0%}",
  ".min-h-0{min-height:0}",
].join("\n");


const QUIET_FRAMES_AFTER_CLICK = 6;

// -- Helpers ------------------------------------------------------------------

// The element mounts once its wasm has loaded and it is defined.
async function getBraccatoElement(container: Element): Promise<BraccatoLyricsElement> {
  await expect.poll(() => container.querySelector("braccato-lyrics")).not.toBeNull();
  return container.querySelector("braccato-lyrics") as BraccatoLyricsElement;
}

// Lines built, and the first frame has handed the element the clock and the theme's lead trims.
async function waitForLyrics(el: BraccatoLyricsElement): Promise<void> {
  await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
  await expect.poll(() => el.tickOptions.playbackRate).toBeDefined();
}

function lineTexts(el: BraccatoLyricsElement): string[] {
  return [...el.querySelectorAll(".blyrics--line")].map((line) => line.textContent ?? "");
}

// Braccato tells a reader's scroll from its own by the position, and takes none for a reader's
// while it settles a fresh layout, so the reader keeps scrolling until it notices.
async function scrollAway(el: BraccatoLyricsElement): Promise<void> {
  await expect.poll(() => el.scrollHeight).toBeGreaterThan(el.clientHeight);
  await expect
    .poll(
      () => {
        if (el.querySelector(".blyrics-user-scrolling")) return true;
        el.scrollTop = el.scrollTop > 0 ? 0 : el.scrollHeight;
        return false;
      },
      { timeout: 5_000 },
    )
    .toBe(true);
}

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;
let layoutStyles: HTMLStyleElement | null = null;

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
  layoutStyles = installStyleSheet(RESUME_AFFORDANCE_LAYOUT_CSS);
});

afterEach(() => {
  probe.dispose();
  layoutStyles?.remove();
  layoutStyles = null;
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
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => litLineText(el)).toContain("second line");
  });

  it("regression: sweeps a word at its own time, with no lead ahead of the playhead", async () => {
    const audio = new Audio();
    audio.currentTime = 11.95;
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildShortWordTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => el.currentTime).toBe(11.95);
    await stepFrames(5);

    expect(isWordLit(el, "go")).toBe(false);

    useAudioStore.getState().seekTo(12.1);
    await expect.poll(() => isWordLit(el, "go")).toBe(true);
  });

  it("moves the highlight as the audio time advances", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => litLineText(el)).toContain("second line");

    useAudioStore.getState().seekTo(26);
    await expect.poll(() => litLineText(el)).toContain("third line");
  });

  it("keeps following the clock while the timeline is scrubbed paused", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
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
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => litLineText(el)).toContain("second line");

    const replacementAudio = new Audio();
    replacementAudio.currentTime = 26;
    useAudioStore.setState({ audioElement: replacementAudio });

    await expect.poll(() => litLineText(el)).toContain("third line");
  });

  it("drives the element clock in seconds, not milliseconds", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.currentTime).toBe(14);
  });

  it("reports the audio play state to the element", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.playing).toBe(false);
  });

  it("regression: sets the sweep from each frame's time until the clock follows the audio after a play", async () => {
    const sample = { currentTime: 11.9, paused: false, followsAudio: false, playbackRate: 1 };
    const playback: RendererPlayback = { sample: () => sample, seekTo: () => {}, play: () => {} };
    onTestFinished(holdFrames("playing"));

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} playback={playback} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => el.currentTime).toBe(11.9);

    sample.currentTime = 11.92;
    await stepFrames(2);
    expect(el.currentTime).toBe(11.92);
    expect(el.playing).toBe(false);

    sample.followsAudio = true;
    await stepFrames(2);
    expect(el.playing).toBe(true);
  });

  it("hands the playback rate over so word sweeps follow the song rather than the wall clock", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    audio.playbackRate = 0.25;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.tickOptions.playbackRate).toBe(0.25);

    audio.playbackRate = 2;

    await expect.poll(() => el.tickOptions.playbackRate).toBe(2);
  });

  it("starts playback when a line is clicked", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    el.querySelector<HTMLElement>(".blyrics--line")?.click();

    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
  });

  it("seeks the audio to the clicked line's start time in seconds", async () => {
    const audio = new Audio();
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
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
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    expect(el.source).toBeNull();
    expect(el.mediaElement).toBeNull();
  });

  it("renders background vocals on their own line, marked apart from the main vocal", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.querySelectorAll(".blyrics-background-line").length).toBe(1);
    const backgroundLine = el.querySelector(".blyrics-background-line");
    expect(backgroundLine?.textContent).toContain("ooh");
    expect(backgroundLine?.textContent).toContain("ahh");
    expect(el.querySelector(".blyrics-line-main")?.textContent).not.toContain("ooh");

    const backgroundWords = [
      ...el.querySelectorAll(".blyrics--word.blyrics-background-lyric"),
    ];
    expect(backgroundWords.map((word) => word.textContent)).toEqual(["ooh", "ahh"]);
  });

  it("shows transliterations and translations from the TTML sidecars", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildAlternateLanguageTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.querySelector(".blyrics--romanized")?.textContent).toContain("annyeong");
    expect(el.querySelector(".blyrics--romanized")?.textContent).toContain("sesang");
    await expect.poll(() => el.querySelector(".blyrics--translated")?.textContent).toContain("Hello world");
  });

  it("spaces alternate-language background vocals inside a foreground pause", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildAlternateBackgroundLanguageTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect
      .poll(() => el.querySelector(".blyrics--romanized")?.textContent?.replace(/\s+/g, " "))
      .toContain("annyeong oh sesang");
    await expect
      .poll(() => el.querySelector(".blyrics--translated")?.textContent?.replace(/\s+/g, " "))
      .toContain("Hello Oh world");
  });

  it("does not show alternate tracks that match the main text", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildMatchingAlternateLanguageTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    expect(el.querySelector(".blyrics--romanized")).toBeNull();
    expect(el.querySelector(".blyrics--translated")).toBeNull();
  });

  it("applies the composer theme, keeping its scroll ratio and long-word glow", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    expect(el.theme).toContain("blyrics-target-scroll-pos-ratio");
    expect(el.theme).toContain("data-long-word");
    expect(el.theme).not.toContain("--blyrics-font-family:");
    expect(el.theme).not.toContain("--blyrics-font-size:");

    expect(el.status).toBe("rendering");
  });

  it("offers a way back when the reader scrolls away, and takes it away on resume", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();

    await scrollAway(el);

    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();

    await screen.getByRole("button", { name: "Resume autoscroll" }).click();

    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  it("regression: an edit swaps into the lines on screen, leaving a reader who scrolled away where they are", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio, isPlaying: true });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await scrollAway(el);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();
    const rendererBefore = el.renderer;
    const firstLineBefore = el.renderer?.lineElements()[0]?.element;

    await screen.rerender(<BraccatoRenderer ttmlString={buildSyncedTtml(120)} />);

    await expect.poll(() => el.lyrics?.at(-1)?.isInstrumental).toBe(true);
    expect(el.renderer).toBe(rendererBefore);
    expect(el.renderer?.lineElements()[0]?.element).toBe(firstLineBefore);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("BraccatoRenderer edge cases", () => {
  it("fills silence between lines with instrumental lines", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.filter((lyric) => lyric.isInstrumental).length).toBe(2);
    await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBe(5);
  });

  it("fills trailing silence with an outro instrumental when the document carries a duration", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml(45)} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.filter((lyric) => lyric.isInstrumental).length).toBe(3);
    const outro = el.lyrics?.at(-1);
    expect(outro?.isInstrumental).toBe(true);
    expect(outro?.startTimeMs).toBe(30_000);
  });

  it("adds no outro instrumental when the document carries no duration", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => el.lyrics?.at(-1)?.words).toBe("third line ends");
    expect(el.lyrics?.at(-1)?.isInstrumental).toBeUndefined();
  });

  it("renders nothing and does not throw for lyrics with no timing", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString="<tt></tt>" />);
    const el = await getBraccatoElement(screen.container);

    await expect.poll(() => el.lyrics).toEqual([]);
    expect(el.querySelectorAll(".blyrics--line")).toHaveLength(0);
  });
});

// -- Invariants ---------------------------------------------------------------

describe("BraccatoRenderer invariants", () => {
  it("regression #174: stops running frames once the audio is paused and idle", async () => {
    useAudioStore.setState({ audioElement: new Audio(), isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    await waitForLyrics(await getBraccatoElement(screen.container));
    await probe.quiesce();

    await settleFrames(probe.count);
    expect(probe.count()).toBe(0);
  });

  it("regression #174: quiesces again once the reader is scrolled back and playback stops", async () => {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await scrollAway(el);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).toBeInTheDocument();

    await screen.getByRole("button", { name: "Resume autoscroll" }).click();
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();

    expect(useAudioStore.getState().isPlaying).toBe(true);
    useAudioStore.getState().setIsPlaying(false);
    await probe.quiesce();

    await settleFrames(probe.count);
    expect(probe.count()).toBe(0);
  });

  it("updates lyrics in place rather than recreating the element", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);
    expect(lineTexts(el).join(" ")).toContain("second line");

    await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);

    await expect.poll(() => lineTexts(el).join(" ")).toContain("ooh");
    expect(await getBraccatoElement(screen.container)).toBe(el);
  });

  it("keeps the element clock following the audio across lyric changes", async () => {
    const audio = new Audio();
    audio.currentTime = 26;
    useAudioStore.setState({ audioElement: audio });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await screen.rerender(<BraccatoRenderer ttmlString={buildBackgroundVocalTtml()} />);

    useAudioStore.getState().seekTo(5);
    await expect.poll(() => el.currentTime).toBe(5);
  });
});

// -- Regressions ---------------------------------------------------------------

describe("BraccatoRenderer regressions", () => {
  type ResumeAffordance = { screen: Awaited<ReturnType<typeof render>>; button: HTMLElement };

  async function showResumeAffordance(): Promise<ResumeAffordance> {
    const audio = new Audio();
    audio.currentTime = 14;
    useAudioStore.setState({ audioElement: audio, isPlaying: false });

    const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
    const el = await getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await scrollAway(el);
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
    expect(useAudioStore.getState().currentTime).toBe(0);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  it("regression: resuming autoscroll from the affordance starts playback again", async () => {
    const { screen } = await showResumeAffordance();
    expect(useAudioStore.getState().isPlaying).toBe(false);

    await screen.getByRole("button", { name: "Resume autoscroll" }).click();

    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  it("regression: clicking a line while scrolled away seeks and takes the reader back", async () => {
    const { screen } = await showResumeAffordance();
    const el = await getBraccatoElement(screen.container);

    el.querySelector<HTMLElement>(".blyrics--line")?.click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBe(2);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });
});
