import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { addGlobalAllowedConsolePattern } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { buildSyncedTtml } from "@/test/ttml-fixtures";
import { BraccatoRenderer } from "@/views/preview/braccato-renderer";
import { TimelinePreviewSidebar } from "@/views/timeline/timeline-preview-sidebar";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { Activity } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function seedThreeLines(): void {
  useProjectStore.setState({
    granularity: "word",
    lines: [
      createLine({ id: "a", text: "first line here", words: [{ text: "first line here", begin: 2, end: 6 }] }),
      createLine({ id: "b", text: "second line now", words: [{ text: "second line now", begin: 12, end: 18 }] }),
      createLine({ id: "c", text: "third line ends", words: [{ text: "third line ends", begin: 24, end: 30 }] }),
    ],
  });
}

async function sidebarLyrics(root: Element): Promise<BraccatoLyricsElement> {
  const sidebar = root.querySelector("aside");
  if (!sidebar) throw new Error("sidebar not rendered");
  await expect.poll(() => sidebar.querySelectorAll("braccato-lyrics .blyrics--line").length).toBeGreaterThan(0);
  const el = sidebar.querySelector<BraccatoLyricsElement>("braccato-lyrics");
  if (!el) throw new Error("braccato-lyrics missing");
  return el;
}

function lineTexts(el: Element): string[] {
  return [...el.querySelectorAll(".blyrics--line")].map((line) => line.textContent ?? "");
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

describe("TimelinePreviewSidebar", () => {
  it("shows the 'No synced content' fallback for an empty project", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<TimelinePreviewSidebar />);
    await expect.element(screen.getByText("No synced content")).toBeInTheDocument();
    expect(screen.container.querySelector("braccato-lyrics")).toBeNull();
  });

  it("renders the preview header and the lyrics through Braccato once any line has timing", async () => {
    seedThreeLines();
    const screen = await render(<TimelinePreviewSidebar />);

    await expect.element(screen.getByText("Preview", { exact: true })).toBeInTheDocument();
    const el = await sidebarLyrics(screen.container);
    expect(lineTexts(el).join(" ")).toContain("second line now");
  });

  it("follows the preview renderer setting to AM Lyrics", async () => {
    useSettingsStore.setState({ previewRenderer: "am-lyrics" });
    seedThreeLines();
    const screen = await render(<TimelinePreviewSidebar />);

    await expect.poll(() => screen.container.querySelector("aside am-lyrics")).not.toBeNull();
    expect(screen.container.querySelector("braccato-lyrics")).toBeNull();
  });

  it("shows the romanization of canonical timed words", async () => {
    useProjectStore.setState({
      granularity: "word",
      lines: [
        {
          id: "canonical-words",
          agentId: "v1",
          text: "한국 노래",
          words: [
            { text: "한국 ", transliteration: "hanguk", begin: 0, end: 1 },
            { text: "노래", transliteration: "norae", begin: 1, end: 2 },
          ],
          transliteration: {
            language: "ko-Latn",
            text: "hanguknorae",
            segments: [{ original: "한국 노래", transliteration: "hanguknorae" }],
            origin: "import",
            sourceFingerprint: "test",
          },
        },
      ],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    const el = await sidebarLyrics(screen.container);

    await expect.poll(() => el.querySelector(".blyrics--romanized")?.textContent ?? "").toMatch(/hanguk\s*norae/);
  });

  it("shows a translation", async () => {
    const line = createLine({ id: "t", text: "안녕 세상", words: [{ text: "안녕 세상", begin: 2, end: 6 }] });
    useProjectStore.setState({
      granularity: "word",
      lines: [
        {
          ...line,
          translations: {
            en: { language: "en", text: "Hello world", origin: "manual", sourceFingerprint: "sidebar-test" },
          },
        },
      ],
    });
    const screen = await render(<TimelinePreviewSidebar />);
    const el = await sidebarLyrics(screen.container);

    await expect.poll(() => el.querySelector(".blyrics--translated")?.textContent).toBe("Hello world");
  });

  it("shows a Timeline edit", async () => {
    seedThreeLines();
    const screen = await render(<TimelinePreviewSidebar />);
    const el = await sidebarLyrics(screen.container);

    useProjectStore
      .getState()
      .updateLineWithHistory("b", { text: "edited line", words: [{ text: "edited line", begin: 12, end: 18 }] });

    await expect.poll(() => lineTexts(el).join(" ")).toContain("edited line");
    expect(lineTexts(el).join(" ")).not.toContain("second line now");
  });

  it("seeks the audio to a clicked line", async () => {
    useAudioStore.setState({ audioElement: new Audio() });
    seedThreeLines();
    const screen = await render(<TimelinePreviewSidebar />);
    const el = await sidebarLyrics(screen.container);

    const secondLine = [...el.querySelectorAll<HTMLElement>(".blyrics--line")].find((line) =>
      line.textContent?.includes("second line now"),
    );
    secondLine?.click();

    await expect.poll(() => useAudioStore.getState().currentTime).toBe(12);
  });

  describe("invariants", () => {
    it("shares one Braccato theme with the hidden Preview tab, so neither view reports a conflict", async () => {
      const errors: string[] = [];
      const recordError = (event: Event) => errors.push(event.type);
      document.addEventListener("braccato:error", recordError, true);
      try {
        const audio = new Audio();
        audio.currentTime = 14;
        useAudioStore.setState({ audioElement: audio });
        seedThreeLines();
        const screen = await render(
          <>
            <Activity mode="hidden">
              <div>
                <BraccatoRenderer ttmlString={buildSyncedTtml()} />
              </div>
            </Activity>
            <TimelinePreviewSidebar />
          </>,
        );
        const sidebar = await sidebarLyrics(screen.container);
        await expect
          .poll(() => sidebar.querySelector(".blyrics--line.blyrics--active")?.textContent)
          .toContain("second line");

        const elements = screen.container.querySelectorAll<BraccatoLyricsElement>("braccato-lyrics");
        expect(elements).toHaveLength(2);
        expect(errors).toEqual([]);
        for (const el of elements) expect(el.status).not.toBe("theme-conflict");
      } finally {
        document.removeEventListener("braccato:error", recordError, true);
      }
    });
  });
});
