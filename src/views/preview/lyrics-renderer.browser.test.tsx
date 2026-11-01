import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useSettingsStore } from "@/stores/settings";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";
import { render } from "@/test/render";
import { buildSyncedTtml } from "@/test/ttml-fixtures";
import { LyricsRenderer } from "@/views/preview/lyrics-renderer";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function waitForElement(container: Element, tag: "braccato-lyrics" | "am-lyrics"): Promise<Element> {
  await expect.poll(() => container.querySelector(tag)).not.toBeNull();
  const el = container.querySelector(tag);
  if (!el) throw new Error(`${tag} element not rendered`);
  return el;
}

let disposeWiring: (() => void) | null = null;

beforeAll(() => {
  addGlobalAllowedConsolePattern(/dev mode/i);
});

beforeEach(() => {
  disposeWiring = wireFrameLoop();
});

afterEach(() => {
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests --------------------------------------------------------------------

describe("LyricsRenderer", () => {
  it("renders Braccato when the preview renderer setting is braccato", async () => {
    useSettingsStore.setState({ previewRenderer: "braccato" });
    const screen = await render(<LyricsRenderer ttmlString={buildSyncedTtml()} durationSeconds={35} />);

    await waitForElement(screen.container, "braccato-lyrics");
    expect(screen.container.querySelector("am-lyrics")).toBeNull();
  });

  it("renders AM Lyrics when the preview renderer setting is am-lyrics", async () => {
    useSettingsStore.setState({ previewRenderer: "am-lyrics" });
    const screen = await render(<LyricsRenderer ttmlString={buildSyncedTtml()} durationSeconds={35} />);

    await waitForElement(screen.container, "am-lyrics");
    expect(screen.container.querySelector("braccato-lyrics")).toBeNull();
  });

  it("swaps the engine when the setting changes", async () => {
    useSettingsStore.setState({ previewRenderer: "braccato" });
    const screen = await render(<LyricsRenderer ttmlString={buildSyncedTtml()} durationSeconds={35} />);
    await waitForElement(screen.container, "braccato-lyrics");

    useSettingsStore.setState({ previewRenderer: "am-lyrics" });

    await waitForElement(screen.container, "am-lyrics");
    await expect.poll(() => screen.container.querySelector("braccato-lyrics")).toBeNull();
  });

  describe("layout", () => {
    it.each(["braccato", "am-lyrics"] as const)("centres a page-width column by default with %s", async (engine) => {
      useSettingsStore.setState({ previewRenderer: engine });
      const screen = await render(<LyricsRenderer ttmlString={buildSyncedTtml()} durationSeconds={35} />);
      const el = await waitForElement(screen.container, engine === "braccato" ? "braccato-lyrics" : "am-lyrics");

      expect(el.classList).toContain("max-w-3xl");
      expect(el.classList).toContain("px-6");
    });

    it.each(["braccato", "am-lyrics"] as const)("fills a narrow sidebar with %s", async (engine) => {
      useSettingsStore.setState({ previewRenderer: engine });
      const screen = await render(
        <LyricsRenderer ttmlString={buildSyncedTtml()} durationSeconds={35} layout="sidebar" />,
      );
      const el = await waitForElement(screen.container, engine === "braccato" ? "braccato-lyrics" : "am-lyrics");

      expect(el.classList).not.toContain("max-w-3xl");
      expect(el.classList).not.toContain("px-6");
      expect(el.classList).toContain("w-full");
    });
  });
});
