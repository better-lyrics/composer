import { deriveTheme } from "@/domain/theme/derive";
import { type Scheme, TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const TTML = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1">Hello<span ttm:role="x-bg"><span begin="00:01.500" end="00:02.000">(ooh)</span></span></p></div></body></tt>`;
const LRC = "[ti:Song]\n[00:01.00]<00:01.00>Hello <00:01.50>world";
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nHello world\n";
const QRC = "[1000,2000]Hello(1000,500) world(1500,500)";
const TTML_FRAGMENT = `<p begin="00:00:12.000" end="00:00:15.200">Line</p>`;

// -- Helpers ------------------------------------------------------------------

function preIn(container: HTMLElement): HTMLPreElement {
  const pre = container.querySelector("pre");
  if (!pre) throw new Error("lyrics code pane not rendered");
  return pre;
}

function tokenTexts(pre: HTMLElement, type: string): string[] {
  return [...pre.querySelectorAll(`.bh-${type}`)].map((span) => span.textContent ?? "");
}

function applyPreset(id: string): { scheme: Scheme; tokens: Record<string, string> } {
  const preset = PRESET_BY_ID.get(id);
  if (!preset) throw new Error(`no preset ${id}`);
  const resolved = deriveTheme(preset);
  applyResolvedTheme(resolved, preset.scheme);
  return { scheme: preset.scheme, tokens: resolved };
}

function resolvedColor(cssColor: string): string {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// -- Tests --------------------------------------------------------------------

describe("LyricsCode", () => {
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

  it("renders the source unchanged as text", async () => {
    const screen = await render(<LyricsCode code={TTML} />);
    expect(preIn(screen.container).textContent).toBe(TTML);
  });

  it("marks the pane with the highlight scope and the caller's classes", async () => {
    const screen = await render(<LyricsCode code={LRC} className="select-text" />);
    const pre = preIn(screen.container);
    expect(pre.classList.contains("bh")).toBe(true);
    expect(pre.classList.contains("select-text")).toBe(true);
  });

  describe("formats", () => {
    it("highlights TTML tags, attributes, times, agents and background text", async () => {
      const pre = preIn((await render(<LyricsCode code={TTML} />)).container);
      expect(tokenTexts(pre, "tag")).toContain("p");
      expect(tokenTexts(pre, "attr")).toContain("begin");
      expect(tokenTexts(pre, "timestamp")).toContain("00:01.000");
      expect(tokenTexts(pre, "agent")).toContain("v1");
      expect(tokenTexts(pre, "bgText")).toEqual(["(ooh)"]);
    });

    it("highlights LRC metadata, line times and word times", async () => {
      const pre = preIn((await render(<LyricsCode code={LRC} />)).container);
      expect(tokenTexts(pre, "meta")).toEqual(["ti"]);
      expect(tokenTexts(pre, "timestamp")).toEqual(["00:01.00"]);
      expect(tokenTexts(pre, "wordTime")).toEqual(["00:01.00", "00:01.50"]);
    });

    it("highlights SRT cue numbers and cue times", async () => {
      const pre = preIn((await render(<LyricsCode code={SRT} />)).container);
      expect(tokenTexts(pre, "meta")).toEqual(["1"]);
      expect(tokenTexts(pre, "timestamp")).toEqual(["00:00:01,000", "00:00:02,000"]);
    });

    it("highlights QRC line and word times", async () => {
      const pre = preIn((await render(<LyricsCode code={QRC} />)).container);
      expect(tokenTexts(pre, "timestamp")).toEqual(["1000,2000"]);
      expect(tokenTexts(pre, "wordTime")).toEqual(["1000,500", "1500,500"]);
    });

    it("leaves plain text as text", async () => {
      const pre = preIn((await render(<LyricsCode code="Just words" />)).container);
      expect(pre.querySelectorAll("span")).toHaveLength(0);
      expect(pre.textContent).toBe("Just words");
    });

    it("highlights a TTML fragment when the format is pinned", async () => {
      const detected = preIn((await render(<LyricsCode code={TTML_FRAGMENT} />)).container);
      expect(detected.querySelectorAll("span")).toHaveLength(0);
      const pinned = preIn((await render(<LyricsCode code={TTML_FRAGMENT} format="ttml" />)).container);
      expect(tokenTexts(pinned, "timestamp")).toEqual(["00:00:12.000", "00:00:15.200"]);
    });
  });

  describe("edge cases", () => {
    it("renders an empty pane for empty source", async () => {
      const pre = preIn((await render(<LyricsCode code="" />)).container);
      expect(pre.textContent).toBe("");
      expect(pre.childNodes).toHaveLength(0);
    });

    it("keeps whitespace, newlines and unicode exactly", async () => {
      const source = "[00:01.00]  沦陷 ・ café \n\n[00:02.00]\tend";
      const pre = preIn((await render(<LyricsCode code={source} />)).container);
      expect(pre.textContent).toBe(source);
    });
  });

  describe("updates", () => {
    it("re-highlights when the source changes", async () => {
      const screen = await render(<LyricsCode code="Just words" />);
      await screen.rerender(<LyricsCode code={LRC} />);
      const pre = preIn(screen.container);
      expect(pre.textContent).toBe(LRC);
      expect(tokenTexts(pre, "timestamp")).toEqual(["00:01.00"]);
    });
  });

  describe("theme", () => {
    it.each(["default", "light"])("colours tokens from the %s theme tokens", async (presetId) => {
      const { tokens } = applyPreset(presetId);
      const pre = preIn((await render(<LyricsCode code={TTML} />)).container);
      const timestamp = pre.querySelector(".bh-timestamp");
      const value = pre.querySelector(".bh-value");
      if (!timestamp || !value) throw new Error("expected timestamp and value tokens");
      expect(getComputedStyle(pre).color).toBe(resolvedColor(tokens.text));
      expect(getComputedStyle(timestamp).color).toBe(resolvedColor(tokens["accent-text"]));
      expect(getComputedStyle(value).color).not.toBe(getComputedStyle(pre).color);
    });

    it("follows a theme change without re-rendering", async () => {
      applyPreset("default");
      const pre = preIn((await render(<LyricsCode code={TTML} />)).container);
      const darkText = getComputedStyle(pre).color;
      const { tokens } = applyPreset("light");
      expect(getComputedStyle(pre).color).toBe(resolvedColor(tokens.text));
      expect(getComputedStyle(pre).color).not.toBe(darkText);
    });
  });
});
