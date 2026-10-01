import { deriveTheme } from "@/domain/theme/derive";
import { TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { LyricsCodeEditor } from "@/ui/lyrics-code/lyrics-code-editor";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { SYNCED_BOX_PROPERTIES } from "@braccato/highlight";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const LRC = "[00:01.00]<00:01.00>Hello <00:01.50>world";
const TTML = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000">Hi</p></div></body></tt>`;
const MONO_STYLE: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  lineHeight: "20px",
  padding: 12,
  border: "1px solid",
};

// -- Helpers ------------------------------------------------------------------

interface HarnessProps {
  initial?: string;
  format?: React.ComponentProps<typeof LyricsCodeEditor>["format"];
  placeholder?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

const Harness: React.FC<HarnessProps> = ({ initial = "", format, placeholder, textareaRef }) => {
  const [value, setValue] = useState(initial);
  const [showNote, setShowNote] = useState(false);
  return (
    <div>
      {showNote && <p>Note before</p>}
      <LyricsCodeEditor
        ref={textareaRef}
        value={value}
        format={format}
        placeholder={placeholder}
        aria-label="Lyrics source"
        onChange={(event) => setValue(event.target.value)}
        style={MONO_STYLE}
        frameClassName="test-frame"
      />
      <button type="button" onClick={() => setValue(LRC)}>
        Load sample
      </button>
      <button type="button" onClick={() => setValue("")}>
        Clear
      </button>
      <button type="button" onClick={() => setShowNote((shown) => !shown)}>
        Toggle note
      </button>
    </div>
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

function clickButton(container: HTMLElement, name: string): void {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === name);
  if (!button) throw new Error(`no ${name} button`);
  button.click();
}

// -- Tests --------------------------------------------------------------------

describe("LyricsCodeEditor", () => {
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

  it("lays a highlighted layer under the textarea inside the frame", async () => {
    const screen = await render(<Harness initial={LRC} />);
    const textarea = textareaIn(screen.container);
    const layer = layerIn(screen.container);
    const frame = screen.container.querySelector(".test-frame");
    expect(textarea.parentElement?.classList.contains("bh-edit")).toBe(true);
    expect(textarea.parentElement?.parentElement).toBe(frame);
    expect(textarea.classList.contains("bh-input")).toBe(true);
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.querySelectorAll(".bh-wordTime")).toHaveLength(2);
  });

  it("keeps the textarea accessible and its value controlled", async () => {
    const screen = await render(<Harness initial={LRC} />);
    const textarea = screen.getByRole("textbox", { name: "Lyrics source" });
    await expect.element(textarea).toHaveValue(LRC);
  });

  it("re-highlights as the user types", async () => {
    const screen = await render(<Harness />);
    const textarea = textareaIn(screen.container);
    textarea.focus();
    await userEvent.keyboard("[[00:01.00]Hi");
    expect(textarea.value).toBe("[00:01.00]Hi");
    expect(layerIn(screen.container).querySelector(".bh-timestamp")?.textContent).toBe("00:01.00");
  });

  it("refreshes the layer when the value changes from code", async () => {
    const screen = await render(<Harness />);
    clickButton(screen.container, "Load sample");
    await expect.poll(() => textareaIn(screen.container).value).toBe(LRC);
    expect(layerIn(screen.container).textContent).toBe(LRC);
    clickButton(screen.container, "Clear");
    await expect.poll(() => textareaIn(screen.container).value).toBe("");
    expect(layerIn(screen.container).textContent).toBe("");
  });

  it("re-highlights when the pinned format changes", async () => {
    const fragment = `<p begin="00:00:12.000" end="00:00:15.200">Line</p>`;
    const screen = await render(<Harness initial={fragment} />);
    expect(layerIn(screen.container).querySelector(".bh-timestamp")).toBeNull();
    await screen.rerender(<Harness initial={fragment} format="ttml" />);
    expect(layerIn(screen.container).querySelectorAll(".bh-timestamp")).toHaveLength(2);
  });

  it("shares the textarea's box with the layer so the colours sit under the caret", async () => {
    const screen = await render(<Harness initial={TTML} />);
    const textareaStyle = getComputedStyle(textareaIn(screen.container));
    const layerStyle = getComputedStyle(layerIn(screen.container));
    expect(textareaStyle.boxSizing).toBe("border-box");
    for (const property of SYNCED_BOX_PROPERTIES) {
      expect(layerStyle.getPropertyValue(property), property).toBe(textareaStyle.getPropertyValue(property));
    }
    const textareaBox = textareaIn(screen.container).getBoundingClientRect();
    const layerBox = layerIn(screen.container).getBoundingClientRect();
    expect(layerBox.width).toBe(textareaBox.width);
    expect(layerBox.height).toBe(textareaBox.height);
  });

  it("fills the frame's height", async () => {
    const screen = await render(<Harness initial={LRC} />);
    const frame = screen.container.querySelector<HTMLElement>(".test-frame");
    if (!frame) throw new Error("frame not rendered");
    frame.style.height = "240px";
    await expect.poll(() => textareaIn(screen.container).getBoundingClientRect().height).toBe(240);
  });

  it("follows the textarea's scroll position", async () => {
    const tall = Array.from({ length: 200 }, (_, index) => `[00:${String(index % 60).padStart(2, "0")}.00]Line`).join(
      "\n",
    );
    const screen = await render(<Harness initial={tall} />);
    const frame = screen.container.querySelector<HTMLElement>(".test-frame");
    if (frame) frame.style.height = "120px";
    const textarea = textareaIn(screen.container);
    textarea.scrollTop = 300;
    textarea.dispatchEvent(new Event("scroll"));
    expect(textarea.scrollTop).toBeGreaterThan(0);
    expect(layerIn(screen.container).scrollTop).toBe(textarea.scrollTop);
  });

  it("keeps the placeholder on the textarea", async () => {
    const screen = await render(<Harness placeholder="Paste LRC" />);
    expect(textareaIn(screen.container).placeholder).toBe("Paste LRC");
    expect(layerIn(screen.container).textContent).toBe("");
  });

  it("forwards its ref to the textarea", async () => {
    let received: HTMLTextAreaElement | null = null;
    const screen = await render(
      <Harness
        textareaRef={(el) => {
          received = el;
        }}
      />,
    );
    expect(received).toBe(textareaIn(screen.container));
  });

  it("colours the caret, selection and placeholder from the theme tokens", async () => {
    const preset = PRESET_BY_ID.get("light");
    if (!preset) throw new Error("no light preset");
    const tokens = deriveTheme(preset);
    applyResolvedTheme(tokens, preset.scheme);
    const screen = await render(<Harness initial={LRC} />);
    const probe = document.createElement("span");
    probe.style.color = tokens.text;
    document.body.append(probe);
    const expectedCaret = getComputedStyle(probe).color;
    probe.remove();
    expect(getComputedStyle(textareaIn(screen.container)).caretColor).toBe(expectedCaret);
    expect(getComputedStyle(layerIn(screen.container)).color).toBe(expectedCaret);
  });

  describe("regressions", () => {
    const focusOnMount = (el: HTMLTextAreaElement | null) => el?.focus();

    it("regression: keeps focus on a textarea focused as it mounts", async () => {
      const screen = await render(<Harness initial={LRC} textareaRef={focusOnMount} />);
      expect(document.activeElement).toBe(textareaIn(screen.container));
    });

    it("regression: keeps focus and the caret when the pinned format changes", async () => {
      const screen = await render(<Harness initial={LRC} />);
      const textarea = textareaIn(screen.container);
      textarea.focus();
      textarea.setSelectionRange(3, 5);
      await screen.rerender(<Harness initial={LRC} format="lrc" />);
      expect(document.activeElement).toBe(textarea);
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([3, 5]);
    });
  });

  describe("lifecycle", () => {
    it("removes the overlay on unmount", async () => {
      const screen = await render(<Harness initial={LRC} />);
      screen.unmount();
      expect(document.querySelector(".bh-edit")).toBeNull();
      expect(document.querySelector(".bh-layer")).toBeNull();
    });

    it("keeps React in charge of siblings rendered around the editor", async () => {
      const screen = await render(<Harness initial={LRC} />);
      clickButton(screen.container, "Toggle note");
      await expect.element(screen.getByText("Note before")).toBeInTheDocument();
      clickButton(screen.container, "Toggle note");
      await expect.element(screen.getByText("Note before")).not.toBeInTheDocument();
      expect(screen.container.querySelectorAll(".bh-edit")).toHaveLength(1);
      expect(layerIn(screen.container).textContent).toBe(LRC);
    });

    it("unmounts cleanly when its parent drops it", async () => {
      const Toggle: React.FC = () => {
        const [shown, setShown] = useState(true);
        return (
          <div>
            {shown && <Harness initial={LRC} />}
            <button type="button" onClick={() => setShown(false)}>
              Hide editor
            </button>
          </div>
        );
      };
      const screen = await render(<Toggle />);
      clickButton(screen.container, "Hide editor");
      await expect.poll(() => screen.container.querySelector("textarea")).toBeNull();
      expect(screen.container.querySelector(".bh-edit")).toBeNull();
    });

    it("attaches one overlay under StrictMode", async () => {
      const screen = await render(
        <StrictMode>
          <Harness initial={LRC} />
        </StrictMode>,
      );
      expect(screen.container.querySelectorAll(".bh-edit")).toHaveLength(1);
      expect(screen.container.querySelectorAll(".bh-layer")).toHaveLength(1);
      expect(layerIn(screen.container).textContent).toBe(LRC);
    });
  });
});
