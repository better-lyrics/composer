import type { BraccatoElement } from "@braccato/core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";
import { render } from "@/test/render";
import { buildRomanizedJapaneseTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";

// -- Helpers ------------------------------------------------------------------

function getBraccatoElement(container: Element): BraccatoElement {
  const el = container.querySelector("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  return el as BraccatoElement;
}

async function waitForLyrics(el: BraccatoElement): Promise<void> {
  await expect.poll(() => el.shadowRoot?.querySelectorAll(".braccato--line").length ?? 0).toBeGreaterThan(0);
}

function allShadowText(el: BraccatoElement): string {
  return el.shadowRoot?.textContent ?? "";
}

// -- Tests --------------------------------------------------------------------

describe("BraccatoRenderer romanization", () => {
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

    const screen = await render(<BraccatoRenderer ttmlString={buildRomanizedJapaneseTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("夜");
  });

  it("renders romaji text from a Composer-exported TTML with dual-emit transliterations", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildRomanizedJapaneseTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("yoru");
    await expect.poll(() => allShadowText(el)).toContain("dakedo");
  });

  it("renders romaji for every line that has transliteration data", async () => {
    useAudioStore.setState({ audioElement: new Audio() });

    const screen = await render(<BraccatoRenderer ttmlString={buildRomanizedJapaneseTtml()} />);
    const el = getBraccatoElement(screen.container);
    await waitForLyrics(el);

    await expect.poll(() => allShadowText(el)).toContain("yume");
    await expect.poll(() => allShadowText(el)).toContain("mite");
  });
});
