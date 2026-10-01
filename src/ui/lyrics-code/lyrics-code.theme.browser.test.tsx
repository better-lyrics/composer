import { deriveTheme } from "@/domain/theme/derive";
import { TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const TTML = `<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml"><head><metadata><ttm:title>Ride Or Die</ttm:title></metadata></head><body><!-- verse --><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1" itunes:key="L1"><span begin="00:01.000" end="00:01.500">Hello</span><span ttm:role="x-bg"><span begin="00:01.500" end="00:02.000">(ooh)</span></span></p></div></body></tt>`;
const LRC = "[ti:Ride Or Die]\n[00:01.00]<00:01.00>Hello <00:01.50>world";
const MIN_CONTRAST: Record<string, number> = {
  text: 4.5,
  bgText: 4.5,
  timestamp: 4.5,
  tag: 3,
  attr: 3,
  value: 3,
  agent: 3,
  meta: 3,
  wordTime: 3,
  punct: 1.8,
  comment: 1.8,
};
const FLOOR_TYPES = new Set(["punct", "comment"]);
const SURFACE_LAYERS_BY_VIEW: Record<string, string[]> = {
  "the export page": ["bg"],
  "a guide page": ["bg-dark"],
  "a converter card": ["bg-elevated"],
  "the lyrics import modal": ["bg-dark", "input"],
};

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
  const [light, dark] = [luminance(composite(foreground, background)), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3];
  return [0, 1, 2].map((i) => foreground[i] * alpha + background[i] * (1 - alpha)).concat(1) as unknown as Rgba;
}

function tokenColor(token: string): Rgba {
  const probe = document.createElement("div");
  probe.style.backgroundColor = `var(--color-composer-${token})`;
  document.body.append(probe);
  const color = parseColor(getComputedStyle(probe).backgroundColor);
  probe.remove();
  return color;
}

function surfaceColor(layers: string[]): Rgba {
  return layers.map(tokenColor).reduce((below, above) => composite(above, below));
}

function contrastByType(pre: HTMLElement, surface: Rgba): Record<string, number> {
  const contrasts: Record<string, number> = { text: contrastOn(parseColor(getComputedStyle(pre).color), surface) };
  for (const type of Object.keys(MIN_CONTRAST)) {
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

    async function renderSamples() {
      const screen = await render(
        <>
          <LyricsCode code={TTML} />
          <LyricsCode code={LRC} />
        </>,
      );
      return [...screen.container.querySelectorAll("pre")];
    }

    it.each(Object.entries(SURFACE_LAYERS_BY_VIEW))("meets each token's minimum contrast on %s", async (_, layers) => {
      const background = surfaceColor(layers);
      const measured = new Set<string>();
      for (const pre of await renderSamples()) {
        for (const [type, contrast] of Object.entries(contrastByType(pre, background))) {
          measured.add(type);
          expect(contrast, type).toBeGreaterThanOrEqual(MIN_CONTRAST[type]);
        }
      }
      expect([...measured].toSorted()).toEqual(Object.keys(MIN_CONTRAST).toSorted());
    });

    it.each(Object.entries(SURFACE_LAYERS_BY_VIEW))(
      "keeps sung words the brightest and punctuation and comments the faintest on %s",
      async (_, layers) => {
        const background = surfaceColor(layers);
        for (const pre of await renderSamples()) {
          const contrasts = contrastByType(pre, background);
          const floor = Math.max(...[...FLOOR_TYPES].flatMap((type) => contrasts[type] ?? []));
          for (const [type, contrast] of Object.entries(contrasts)) {
            if (type !== "text") expect(contrast, `${type} vs text`).toBeLessThan(contrasts.text);
            if (!FLOOR_TYPES.has(type) && Number.isFinite(floor)) {
              expect(contrast, `${type} vs punctuation and comments`).toBeGreaterThan(floor);
            }
          }
        }
      },
    );

    it("paints every token in an opaque colour", async () => {
      for (const pre of await renderSamples()) {
        for (const element of [pre, ...pre.querySelectorAll("span")]) {
          expect(parseColor(getComputedStyle(element).color)[3], element.className || "text").toBe(1);
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
  });
});
