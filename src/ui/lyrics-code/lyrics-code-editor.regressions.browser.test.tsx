import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCodeEditor } from "@/ui/lyrics-code/lyrics-code-editor";
import type { LyricFormat } from "@braccato/highlight";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

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
});
