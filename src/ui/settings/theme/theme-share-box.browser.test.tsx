import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeThemeCode } from "@/domain/theme/code";
import type { Theme } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { ThemeShareBox } from "@/ui/settings/theme/theme-share-box";
import { render } from "@/test/render";

// -- Fixtures ------------------------------------------------------------------

function draftFrom(id: string): Theme {
  const base = PRESET_BY_ID.get(id);
  if (!base) throw new Error(`Unknown preset ${id}`);
  return {
    id: "draft",
    name: `${base.name} (copy)`,
    kind: "custom",
    base: id,
    scheme: base.scheme,
    tokens: { ...base.tokens },
  };
}

interface ClipboardStub {
  writes: string[];
  restore: () => void;
}

function stubClipboard(writeText: (text: string) => Promise<void>): ClipboardStub {
  const writes: string[] = [];
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
  Object.defineProperty(Navigator.prototype, "clipboard", {
    configurable: true,
    get: () => ({
      writeText: async (text: string) => {
        writes.push(text);
        await writeText(text);
      },
    }),
  });
  return {
    writes,
    restore: () => {
      if (original) {
        Object.defineProperty(Navigator.prototype, "clipboard", original);
      } else {
        (Navigator.prototype as unknown as Record<string, unknown>).clipboard = undefined;
      }
    },
  };
}

// -- Tests --------------------------------------------------------------------

describe("ThemeShareBox", () => {
  let clipboard: ClipboardStub;

  afterEach(() => {
    clipboard?.restore();
  });

  describe("happy path", () => {
    beforeEach(() => {
      clipboard = stubClipboard(() => Promise.resolve());
    });

    it("shows the encoded theme code in a read-only textarea", async () => {
      const draft = draftFrom("harbor");
      const screen = await render(<ThemeShareBox draft={draft} />);
      const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
      expect(box.readOnly).toBe(true);
      expect(box.value).toBe(encodeThemeCode(draft));
    });

    it("encodes a different draft's code", async () => {
      const next = draftFrom("nord");
      const screen = await render(<ThemeShareBox draft={next} />);
      const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
      expect(box.value).toBe(encodeThemeCode(next));
    });

    it("renders a Copy code button", async () => {
      const screen = await render(<ThemeShareBox draft={draftFrom("harbor")} />);
      await expect.element(screen.getByRole("button", { name: /Copy code/ })).toBeInTheDocument();
    });

    it("writes the encoded code to the clipboard and switches to Copied after a click", async () => {
      const draft = draftFrom("harbor");
      const screen = await render(<ThemeShareBox draft={draft} />);
      await screen.getByRole("button", { name: /Copy code/ }).click();
      await expect.element(screen.getByRole("button", { name: /Copied/ })).toBeInTheDocument();
      expect(clipboard.writes).toEqual([encodeThemeCode(draft)]);
    });
  });

  describe("error paths", () => {
    beforeEach(() => {
      clipboard = stubClipboard(() => Promise.reject(new Error("Clipboard blocked")));
    });

    it("does NOT show Copied and surfaces the error when the clipboard write throws", async () => {
      const screen = await render(<ThemeShareBox draft={draftFrom("harbor")} />);
      await screen.getByRole("button", { name: /Copy code/ }).click();
      await expect.element(screen.getByText("Clipboard blocked")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("Copied");
    });
  });
});
