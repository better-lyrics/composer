import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { POSITION_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import braccatoLyricsCss from "@braccato/core/styles/lyrics.css?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants -----------------------------------------------------------------

// Tailwind never reaches the test document, so the sidebar's box and the classes that float the
// affordance over the lyrics are installed by hand.
const SIDEBAR_LAYOUT_CSS = [
  braccatoLyricsCss,
  POSITION_UTILITIES_CSS,
  ".bottom-3{bottom:0.75rem}",
  ".left-1\\/2{left:50%}",
  ".z-10{z-index:10}",
  "braccato-lyrics{display:block;overflow-y:auto}",
  ".flex{display:flex}",
  ".flex-col{flex-direction:column}",
  ".flex-1{flex:1 1 0%}",
  ".min-h-0{min-height:0}",
].join("\n");

const SIDEBAR_BOX_CSS = "display:flex;flex-direction:column;width:320px;height:600px";

// -- Helpers ------------------------------------------------------------------

async function scrollAwayInSidebar() {
  const audio = new Audio();
  audio.currentTime = 14;
  useAudioStore.setState({ audioElement: audio, isPlaying: false });

  const screen = await render(<BraccatoRenderer ttmlString={buildSyncedTtml()} layout="sidebar" />);
  screen.container.style.cssText = SIDEBAR_BOX_CSS;
  const el = screen.container.querySelector<BraccatoLyricsElement>("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics element not rendered");
  await expect.poll(() => el.querySelectorAll(".blyrics--line").length).toBeGreaterThan(0);

  for (let i = 0; i < 5; i++) el.dispatchEvent(new Event("scroll"));
  const affordance = screen.getByRole("button", { name: "Resume autoscroll" });
  await expect.element(affordance).toBeInTheDocument();
  return { screen, affordance };
}

let disposeWiring: (() => void) | null = null;
let layoutStyles: HTMLStyleElement | null = null;

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  layoutStyles = installStyleSheet(SIDEBAR_LAYOUT_CSS);
});

afterEach(() => {
  layoutStyles?.remove();
  layoutStyles = null;
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests --------------------------------------------------------------------

describe("BraccatoRenderer sidebar layout", () => {
  it("offers a compact, icon-only way back when the reader scrolls away", async () => {
    const { affordance } = await scrollAwayInSidebar();

    expect(affordance.element().textContent).toBe("");
    expect(affordance.element().getAttribute("title")).toBe("Resume autoscroll");
  });

  it("resumes autoscroll and playback from the compact button", async () => {
    const { screen, affordance } = await scrollAwayInSidebar();

    await affordance.click();

    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  it("resumes from the keyboard", async () => {
    const { screen, affordance } = await scrollAwayInSidebar();
    const button = affordance.element();
    if (!(button instanceof HTMLButtonElement)) throw new Error("affordance is not a button");

    button.focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByRole("button", { name: "Resume autoscroll" })).not.toBeInTheDocument();
  });

  describe("regressions", () => {
    it("regression: the compact affordance is the topmost element at its own centre", async () => {
      const { affordance } = await scrollAwayInSidebar();
      const button = affordance.element();
      const rect = button.getBoundingClientRect();

      const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

      expect(topmost?.closest("button")).toBe(button);
    });
  });
});
