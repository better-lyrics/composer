import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { restoreProvidersForTests, snapshotProvidersForTests } from "@/utils/lyrics-search/registry";
import type { LyricsSearchProvider } from "@/utils/lyrics-search/types";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { LyricsImportModalHost } from "@/views/lyrics-import-modal/lyrics-import-modal-host";

const SRT = "1\n00:00:02,000 --> 00:00:04,500\nFirst subtitle line\n\n2\n00:00:05,000 --> 00:00:07,000\nSecond line";
const TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000">Hello</p></div></body></tt>';
const PLAIN = "Verse one first line\nVerse one sec|ond line\n\n(Background only line)\nMain line (with background)\n";

let providerSnapshot: readonly LyricsSearchProvider[] = [];

beforeEach(() => {
  providerSnapshot = snapshotProvidersForTests();
  restoreProvidersForTests([]);
  useSettingsStore.setState({ confirmReplaceLyrics: false });
});

afterEach(() => {
  restoreProvidersForTests(providerSnapshot);
  useImportModalStore.getState().close();
});

function host(): React.ReactElement {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <LyricsImportModalHost />
      <ConfirmModalHost />
      <Toaster />
    </QueryClientProvider>
  );
}

function pasteTextarea(): HTMLTextAreaElement {
  const textarea = document.querySelector("textarea");
  if (!textarea) throw new Error("paste textarea not rendered");
  return textarea;
}

function uploadDropzone(): HTMLElement {
  const dropzone = document.querySelector<HTMLElement>("[data-upload-dropzone]");
  if (!dropzone) throw new Error("upload dropzone not rendered");
  return dropzone;
}

async function pasteAndImport(screen: Awaited<ReturnType<typeof render>>, text: string) {
  useImportModalStore.getState().open({ section: "paste" });
  await expect.poll(() => document.querySelector("textarea")).not.toBeNull();
  const textarea = pasteTextarea();
  textarea.focus();
  await userEvent.fill(textarea, text);
  await screen.getByRole("button", { name: /^Import$/ }).click();
  await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
}

async function uploadAndImport(screen: Awaited<ReturnType<typeof render>>, name: string, content: string) {
  useImportModalStore.getState().open({ section: "upload" });
  await expect.poll(() => document.querySelector("[data-upload-dropzone]")).not.toBeNull();
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File([content], name, { type: "text/plain" }));
  uploadDropzone().dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  await expect.element(screen.getByText(/Ready to import/i)).toBeInTheDocument();
  await screen.getByRole("button", { name: /^Import$/ }).click();
}

describe("I1 paste path format detection", () => {
  it("pasted SRT is parsed as SRT, not as raw lyric lines", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    const screen = await render(host());
    await pasteAndImport(screen, SRT);
    const texts = useProjectStore.getState().lines.map((line) => line.text);
    expect(texts).toEqual(["First subtitle line", "Second line"]);
  });

  it("pasted TTML is parsed as TTML, not as raw lyric lines", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    const screen = await render(host());
    await pasteAndImport(screen, TTML);
    const texts = useProjectStore.getState().lines.map((line) => line.text);
    expect(texts).toEqual(["Hello"]);
  });
});

describe("I6 paste and upload of the same text", () => {
  it("produce the same lines", async () => {
    const screen = await render(host());
    await pasteAndImport(screen, PLAIN);
    const pasted = useProjectStore
      .getState()
      .lines.map((line) => ({ text: line.text, backgroundText: line.backgroundText ?? null }));

    await uploadAndImport(screen, "plain.txt", PLAIN);
    await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
    const uploaded = useProjectStore
      .getState()
      .lines.map((line) => ({ text: line.text, backgroundText: line.backgroundText ?? null }));

    expect(uploaded).toEqual(pasted);
  });
});
