import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";
import { render } from "@/test/render";
import { buildRomanizedJapaneseTtml } from "@/test/ttml-fixtures";
import { AmLyricsRenderer } from "@/views/preview/am-lyrics-renderer";

// -- Constants ----------------------------------------------------------------

const SONG_DURATION_SECONDS = 30;

// -- Helpers ------------------------------------------------------------------

async function waitForAmLyrics(container: Element): Promise<Element> {
  await expect.poll(() => container.querySelector("am-lyrics") !== null).toBe(true);
  const el = container.querySelector("am-lyrics");
  if (!el) throw new Error("am-lyrics element not rendered");
  return el;
}

async function waitForLyrics(el: Element): Promise<void> {
  await expect
    .poll(() => el.shadowRoot?.querySelectorAll(".lyrics-line:not(.lyrics-gap)").length ?? 0)
    .toBeGreaterThan(0);
  await expect.poll(() => allShadowText(el)).toContain("夜");
}

function allShadowText(el: Element): string {
  return el.shadowRoot?.textContent ?? "";
}

// -- Tests --------------------------------------------------------------------

describe("AmLyricsRenderer romanization", () => {
  beforeAll(() => {
    addGlobalAllowedConsolePattern(/dev mode/i);
  });

  beforeEach(() => {
    useProjectStore.setState((s) => ({
      metadata: { ...s.metadata, romanizationScheme: "ja-Latn-hepburn" },
    }));
  });

  it("renders the source line text", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(
      <AmLyricsRenderer ttmlString={buildRomanizedJapaneseTtml()} durationSeconds={SONG_DURATION_SECONDS} />,
    );
    const el = await waitForAmLyrics(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("夜");
  });

  it("renders romaji text from a Composer-exported TTML with transliterations", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(
      <AmLyricsRenderer ttmlString={buildRomanizedJapaneseTtml()} durationSeconds={SONG_DURATION_SECONDS} />,
    );
    const el = await waitForAmLyrics(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("yoru");
    await expect.poll(() => allShadowText(el)).toContain("dakedo");
  });

  it("renders romaji for every line that has transliteration data", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(
      <AmLyricsRenderer ttmlString={buildRomanizedJapaneseTtml()} durationSeconds={SONG_DURATION_SECONDS} />,
    );
    const el = await waitForAmLyrics(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("yume");
    await expect.poll(() => allShadowText(el)).toContain("mite");
  });
});
