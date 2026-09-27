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

const WEIRD_LRC = "[00:99.99]Invalid time\n[aa:bb.cc]garbage\nplain line no timestamp\n[00:01.00]valid\n";
const LRC_WITH_IGNORED_TAG = "[00:01.00][00:75.00]Chorus\n[00:99.00]Broken\n[00:05.00]Next\n";
const LRCLIB_STYLE_PASTE =
  "\n\n  [ar: Queen]\n[ti: Bohemian Rhapsody]\n[length: 05:55]\n\n[00:00.63] Is this the real life?\n[00:04.21] Is this just fantasy?\n";

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

describe("pasted LRC", () => {
  it("reads a paste that opens with blank lines and metadata tags as timed LRC", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    const screen = await render(host());
    await pasteAndImport(screen, LRCLIB_STYLE_PASTE);
    const { lines, metadata } = useProjectStore.getState();
    expect(lines.map((line) => [line.text, line.begin])).toEqual([
      ["Is this the real life?", 0.63],
      ["Is this just fantasy?", 4.21],
    ]);
    expect(metadata.title).toBe("Bohemian Rhapsody");
  });

  it("gives pasted lines the first singer of the project", async () => {
    useProjectStore.getState().setAgents([{ id: "v2", type: "person", name: "Bob" }]);
    const screen = await render(host());
    await pasteAndImport(screen, "First line\nSecond line");
    expect(useProjectStore.getState().lines.map((line) => line.agentId)).toEqual(["v2", "v2"]);
  });
});

describe("I4 broken or empty lyrics files", () => {
  it("tells the user when broken.ttml yields no lyrics", async () => {
    const screen = await render(host());
    await uploadAndImport(screen, "broken.ttml", '<tt><body><p begin="00:01.000"');
    await expect
      .poll(() => document.body.textContent ?? "", { timeout: 3000 })
      .toMatch(/could not|couldn't|invalid|no lyrics|failed|empty|nothing to import/i);
  });

  it("shows an error for an empty file and leaves the project unchanged", async () => {
    useProjectStore.getState().setMetadata({ title: "Kept" });
    const before = useProjectStore.getState();
    const screen = await render(host());
    await uploadAndImport(screen, "empty.lrc", "");
    await expect.element(screen.getByText("No lyrics found in empty.lrc.")).toBeInTheDocument();
    const after = useProjectStore.getState();
    expect(after.lines).toBe(before.lines);
    expect(after.metadata).toBe(before.metadata);
    expect(after.history).toBe(before.history);
  });
});

describe("partially readable lyrics files", () => {
  it("imports the good lines of an LRC and warns about the rest", async () => {
    const screen = await render(host());
    await uploadAndImport(screen, "weird.lrc", WEIRD_LRC);
    await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["valid"]);
    await expect.element(screen.getByText("Imported 1 line. 3 lines could not be read.")).toBeInTheDocument();
  });

  it("does not count a line that imported despite an ignored timestamp as unread", async () => {
    const screen = await render(host());
    await uploadAndImport(screen, "mixed.lrc", LRC_WITH_IGNORED_TAG);
    await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Chorus", "Next"]);
    await expect.element(screen.getByText("Imported 2 lines. 1 line could not be read.")).toBeInTheDocument();
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
