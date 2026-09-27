import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { POSITION_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { type FrameProbe, createFrameProbe } from "@/test/frame-probe";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import braccatoLyricsCss from "@braccato/core/styles/lyrics.css?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Constants -----------------------------------------------------------------

const LINE_COUNT = 15;
const WORD_SECONDS = 2;
const VIEWPORT_HEIGHT = 200;

// Tailwind never reaches the test document, so the bounded flex column that makes the lyrics
// element the scroller comes from the harness.
const SIDEBAR_LAYOUT_CSS = [
  braccatoLyricsCss,
  POSITION_UTILITIES_CSS,
  "braccato-lyrics{display:block;overflow-y:auto}",
  ".flex{display:flex}",
  ".flex-col{flex-direction:column}",
  ".flex-1{flex:1 1 0%}",
  ".min-h-0{min-height:0}",
  ".overflow-hidden{overflow:hidden}",
].join("\n");

// -- Harness -------------------------------------------------------------------

const Harness: React.FC = () => (
  <div style={{ display: "flex", height: VIEWPORT_HEIGHT }}>
    <TimelinePreviewSidebar />
  </div>
);

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;
let layoutStyles: HTMLStyleElement | null = null;

function seedLines(): void {
  useProjectStore.setState({
    granularity: "word",
    lines: Array.from({ length: LINE_COUNT }, (_, index) =>
      createLine({
        id: `line-${index}`,
        text: `line ${index}`,
        words: [{ text: `line ${index}`, begin: index * WORD_SECONDS, end: (index + 1) * WORD_SECONDS }],
      }),
    ),
  });
}

function attachAudio(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.getState().registerAudioElement(audioElement);
  return audioElement;
}

async function lyricsElement(root: Element): Promise<BraccatoLyricsElement> {
  await expect.poll(() => root.querySelectorAll("braccato-lyrics .blyrics--line").length).toBeGreaterThan(0);
  const el = root.querySelector<BraccatoLyricsElement>("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics missing");
  return el;
}

function activeLineStart(el: Element): string | undefined {
  return el.querySelector<HTMLElement>(".blyrics--line.blyrics--active")?.dataset.time;
}

function romanizedText(el: Element): string {
  return [...el.querySelectorAll(".blyrics--romanized")].map((node) => node.textContent ?? "").join(" ");
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
  layoutStyles = installStyleSheet(SIDEBAR_LAYOUT_CSS);
});

afterEach(() => {
  layoutStyles?.remove();
  layoutStyles = null;
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("TimelinePreviewSidebar on the frame loop", () => {
  it("highlights the line under the audio while it plays", async () => {
    seedLines();
    const audioElement = attachAudio();
    const screen = await render(<Harness />);
    const el = await lyricsElement(screen.container);

    useAudioStore.getState().setIsPlaying(true);
    audioElement.currentTime = 3;

    await expect.poll(() => activeLineStart(el)).toBe(String(1 * WORD_SECONDS));
  });

  it("moves the highlight after a seek while paused", async () => {
    seedLines();
    attachAudio();
    const screen = await render(<Harness />);
    const el = await lyricsElement(screen.container);

    useAudioStore.getState().seekTo(9);

    await expect.poll(() => activeLineStart(el)).toBe(String(4 * WORD_SECONDS));
  });

  it("shows main and background romanizations", async () => {
    const line = createLine({
      text: "안녕",
      words: [{ text: "안녕", begin: 0, end: 2 }],
      backgroundText: "세상",
      backgroundWords: [{ text: "세상", begin: 1, end: 3 }],
    });
    useProjectStore.setState({
      granularity: "word",
      lines: [
        {
          ...line,
          transliteration: {
            language: "ko-Latn",
            text: "annyeong",
            backgroundText: "sesang",
            segments: [{ original: "안녕", transliteration: "annyeong" }],
            backgroundSegments: [{ original: "세상", transliteration: "sesang" }],
            origin: "manual",
            sourceFingerprint: "preview-frame-test",
          },
        },
      ],
    });
    attachAudio();
    const screen = await render(<Harness />);
    const el = await lyricsElement(screen.container);

    await expect.poll(() => romanizedText(el)).toContain("annyeong");
    expect(romanizedText(el)).toContain("sesang");
  });

  it("shows a romanization over line-synced timing", async () => {
    const line = createLine({ text: "안녕하세요", begin: 2, end: 6 });
    useProjectStore.setState({
      granularity: "line",
      lines: [
        {
          ...line,
          transliteration: {
            language: "ko-Latn",
            text: "annyeonghaseyo",
            segments: [{ original: "안녕하세요", transliteration: "annyeonghaseyo" }],
            origin: "manual",
            sourceFingerprint: "preview-line-frame-test",
          },
        },
      ],
    });
    attachAudio();
    const screen = await render(<Harness />);
    const el = await lyricsElement(screen.container);

    await expect.poll(() => romanizedText(el)).toContain("annyeonghaseyo");
  });

  it("scrolls the active line into view", async () => {
    seedLines();
    attachAudio();
    const screen = await render(<Harness />);
    const el = await lyricsElement(screen.container);
    const scrollTopBefore = el.scrollTop;

    useAudioStore.getState().seekTo(25);

    await expect.poll(() => activeLineStart(el)).toBe(String(12 * WORD_SECONDS));
    await expect.poll(() => el.scrollTop).toBeGreaterThan(scrollTopBefore);
  });

  describe("invariants", () => {
    it("regression #174: stops running frames once the audio is paused and idle", async () => {
      seedLines();
      attachAudio();
      const screen = await render(<Harness />);
      await lyricsElement(screen.container);
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });

    it("regression #174: stops running frames when there is nothing synced to preview", async () => {
      useProjectStore.setState({ lines: [] });
      await render(<Harness />);
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });
  });
});
