import { deriveTheme } from "@/domain/theme/derive";
import { TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const TTML = `<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml"><head><metadata><ttm:title>Ride Or Die</ttm:title></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Hello</span><span ttm:role="x-bg"><span begin="00:01.500" end="00:02.000">(ooh)</span></span></p></div></body></tt>`;
const LRC = "[00:01.00]<00:01.00>Hello <00:01.50>world";
const MARKUP_TYPES = ["timestamp", "agent", "meta", "tag", "attr", "value", "punct", "comment"] as const;
const SURFACES = ["bg-elevated", "bg-dark"] as const;

// -- Helpers ------------------------------------------------------------------

type Rgba = [number, number, number, number];

function parseColor(css: string): Rgba {
  const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(css);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, Number(srgb[4] ?? 1)];
  const rgb = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/.exec(css);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)];
  throw new Error(`unparsed colour ${css}`);
}

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastOn(foreground: Rgba, background: Rgba): number {
  const alpha = foreground[3];
  const composite: Rgba = [0, 1, 2].map((i) => foreground[i] * alpha + background[i] * (1 - alpha)) as unknown as Rgba;
  const [light, dark] = [luminance(composite), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function surfaceColor(token: string): Rgba {
  const probe = document.createElement("div");
  probe.style.backgroundColor = `var(--color-composer-${token})`;
  document.body.append(probe);
  const color = parseColor(getComputedStyle(probe).backgroundColor);
  probe.remove();
  return color;
}

function contrastByType(pre: HTMLElement, surface: Rgba): Record<string, number> {
  const contrasts: Record<string, number> = { text: contrastOn(parseColor(getComputedStyle(pre).color), surface) };
  for (const type of [...MARKUP_TYPES, "wordTime", "bgText"]) {
    const span = pre.querySelector(`.bh-${type}`);
    if (span) contrasts[type] = contrastOn(parseColor(getComputedStyle(span).color), surface);
  }
  return contrasts;
}

// -- Tests --------------------------------------------------------------------

describe("LyricsCode theme ratios", () => {
  let sheet: HTMLStyleElement;

  beforeEach(() => {
    sheet = installStyleSheet(LYRICS_CODE_CSS);
  });

  afterEach(() => {
    sheet.remove();
    const root = document.documentElement;
    for (const token of TOKENS) root.style.removeProperty(token.varName);
    delete root.dataset.scheme;
  });

  describe.each(["default", "light", "high-contrast"])("%s theme", (presetId) => {
    beforeEach(() => {
      const preset = PRESET_BY_ID.get(presetId);
      if (!preset) throw new Error(`no preset ${presetId}`);
      applyResolvedTheme(deriveTheme(preset), preset.scheme);
    });

    it.each(SURFACES)("keeps sung words the brightest and punctuation the faintest on %s", async (surface) => {
      const background = surfaceColor(surface);
      const screen = await render(
        <>
          <LyricsCode code={TTML} />
          <LyricsCode code={LRC} />
        </>,
      );
      for (const pre of screen.container.querySelectorAll("pre")) {
        const contrasts = contrastByType(pre, background);
        for (const [type, contrast] of Object.entries(contrasts)) {
          if (type !== "text") expect(contrast, `${type} vs text`).toBeLessThan(contrasts.text);
          if (type !== "punct" && contrasts.punct !== undefined) {
            expect(contrast, `${type} vs punct`).toBeGreaterThan(contrasts.punct);
          }
        }
      }
    });

    it("sets background vocals apart from the main words", async () => {
      const screen = await render(<LyricsCode code={TTML} />);
      const pre = screen.container.querySelector("pre");
      const bgText = pre?.querySelector(".bh-bgText");
      if (!pre || !bgText) throw new Error("background vocals not rendered");
      expect(getComputedStyle(bgText).color).not.toBe(getComputedStyle(pre).color);
      expect(getComputedStyle(bgText).fontStyle).toBe("italic");
    });

    it("keeps lyric text readable", async () => {
      const screen = await render(<LyricsCode code={LRC} />);
      const pre = screen.container.querySelector("pre");
      if (!pre) throw new Error("pane not rendered");
      expect(contrastOn(parseColor(getComputedStyle(pre).color), surfaceColor("bg-elevated"))).toBeGreaterThan(4.5);
    });
  });
});
