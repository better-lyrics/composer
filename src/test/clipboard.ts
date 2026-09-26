// Headless Chromium denies clipboard writes without a permission grant, so tests record them instead.

// -- Types ---------------------------------------------------------------------

interface ClipboardStub {
  writes: string[];
  restore: () => void;
}

// -- Helpers -------------------------------------------------------------------

function stubClipboard(writeText: (text: string) => Promise<void> = () => Promise.resolve()): ClipboardStub {
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

// -- Exports -------------------------------------------------------------------

export { stubClipboard };
export type { ClipboardStub };
