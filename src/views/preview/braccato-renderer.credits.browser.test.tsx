import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { render } from "@/test/render";
import { buildAppleSongwriterTtml, buildSongwriterTtml, buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function getBraccatoElement(container: Element): BraccatoLyricsElement {
  const el = container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  return el;
}

async function waitForLyrics(el: BraccatoLyricsElement): Promise<void> {
  await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
}

function creditsText(el: BraccatoLyricsElement): string | null {
  return el.querySelector(".blyrics-credits")?.textContent ?? null;
}

let disposeWiring: (() => void) | null = null;

beforeEach(() => {
  disposeWiring = wireFrameLoop();
});

afterEach(() => {
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests --------------------------------------------------------------------

describe("BraccatoRenderer songwriter credits", () => {
  it("credits every songwriter after the last line", async () => {
    const screen = await render(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada", "Grace", "Linus"])} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => creditsText(el)).toBe("Ada, Grace & Linus");
    const lines = el.querySelectorAll(".blyrics--line");
    const credits = el.querySelector(".blyrics-credits");
    if (!credits) throw new Error("credits missing");
    expect(lines[lines.length - 1].compareDocumentPosition(credits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("credits the songwriters of an imported Apple TTML", async () => {
    const screen = await render(<BraccatoRenderer ttmlString={buildAppleSongwriterTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => creditsText(el)).toBe("Apple Writer & Second Writer");
  });

  it("updates the credits when the songwriters are edited", async () => {
    const screen = await render(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada"])} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);
    await expect.poll(() => creditsText(el)).toBe("Ada");

    await screen.rerender(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada", "Grace"])} />);

    await expect.poll(() => creditsText(el)).toBe("Ada & Grace");
  });

  describe("edge cases", () => {
    it("renders no credits when the song has no songwriters", async () => {
      const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);
      const el = getBraccatoElement(screen.container);
      await waitForLyrics(el);

      expect(el.querySelector(".blyrics-credits")).toBeNull();
    });

    it("drops the credits when every songwriter is removed", async () => {
      const screen = await render(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada"])} />);
      const el = getBraccatoElement(screen.container);
      await waitForLyrics(el);
      await expect.poll(() => creditsText(el)).toBe("Ada");

      await screen.rerender(<BraccatoRenderer ttmlString={buildSyncedTtml()} />);

      await expect.poll(() => el.querySelector(".blyrics-credits")).toBeNull();
      expect(el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);
    });
  });

  describe("regressions", () => {
    it("regression: keeps the credits when a lyrics edit rebuilds the view", async () => {
      const screen = await render(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada"])} />);
      const el = getBraccatoElement(screen.container);
      await waitForLyrics(el);
      const rendererBefore = el.renderer;

      await screen.rerender(<BraccatoRenderer ttmlString={buildSongwriterTtml(["Ada", "Grace"])} />);

      await expect.poll(() => el.renderer).not.toBe(rendererBefore);
      await expect.poll(() => creditsText(el)).toBe("Ada & Grace");
    });
  });
});
