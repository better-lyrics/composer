import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCodeEditor } from "@/ui/lyrics-code/lyrics-code-editor";
import type { LyricFormat } from "@braccato/highlight";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const TTML_FRAGMENT = `<p begin="00:00:12.000" end="00:00:15.200">Line</p>`;

// -- Helpers ------------------------------------------------------------------

interface HarnessProps {
  initial?: string;
  className?: string;
  format?: LyricFormat;
  accept?: (next: string) => boolean;
}

const Harness: React.FC<HarnessProps> = ({ initial = "", className, format, accept = () => true }) => {
  const [value, setValue] = useState(initial);
  return (
    <LyricsCodeEditor
      value={value}
      format={format}
      aria-label="Lyrics source"
      className={className}
      onChange={(event) => {
        if (accept(event.target.value)) setValue(event.target.value);
      }}
    />
  );
};

function textareaIn(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("textarea not rendered");
  return textarea;
}

function layerIn(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>(".bh-edit > .bh-layer");
  if (!layer) throw new Error("highlight layer not rendered");
  return layer;
}

// -- Tests --------------------------------------------------------------------

describe("LyricsCodeEditor regressions", () => {
  let sheet: HTMLStyleElement;

  beforeEach(() => {
    sheet = installStyleSheet(LYRICS_CODE_CSS);
  });

  afterEach(() => {
    sheet.remove();
  });

  it("regression: keeps the overlay input class when the caller's className changes", async () => {
    const screen = await render(<Harness initial="[00:01.00]Hi" className="short" />);
    await screen.rerender(<Harness initial="[00:01.00]Hi" className="long" />);
    const textarea = textareaIn(screen.container);
    expect(textarea.classList.contains("long")).toBe(true);
    expect(textarea.classList.contains("bh-input")).toBe(true);
    expect(getComputedStyle(textarea).color).toBe("rgba(0, 0, 0, 0)");
  });

  it("regression: the layer follows the textarea when the parent rejects a keystroke", async () => {
    const screen = await render(<Harness initial="[00:01.00]Hi" accept={(next) => !next.includes("!")} />);
    const textarea = textareaIn(screen.container);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.keyboard("!");
    expect(textarea.value).toBe("[00:01.00]Hi");
    await expect.poll(() => layerIn(screen.container).textContent).toBe("[00:01.00]Hi");
  });

  it("regression: a pinned format change re-highlights without wiping native undo", async () => {
    const screen = await render(<Harness initial={TTML_FRAGMENT} />);
    const textarea = textareaIn(screen.container);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    document.execCommand("insertText", false, "x");
    await expect.poll(() => textarea.value).toBe(`${TTML_FRAGMENT}x`);
    await screen.rerender(<Harness initial={TTML_FRAGMENT} format="ttml" />);
    await expect.poll(() => layerIn(screen.container).querySelectorAll(".bh-timestamp")).toHaveLength(2);
    expect(textarea.parentElement?.classList.contains("bh-edit")).toBe(true);
    expect(document.execCommand("undo")).toBe(true);
    await expect.poll(() => textarea.value).toBe(TTML_FRAGMENT);
  });

  it("regression: keystrokes after a format change keep the new format", async () => {
    const screen = await render(<Harness initial={TTML_FRAGMENT} />);
    await screen.rerender(<Harness initial={TTML_FRAGMENT} format="ttml" />);
    const textarea = textareaIn(screen.container);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.keyboard(" ");
    expect(layerIn(screen.container).querySelectorAll(".bh-timestamp")).toHaveLength(2);
  });
});
