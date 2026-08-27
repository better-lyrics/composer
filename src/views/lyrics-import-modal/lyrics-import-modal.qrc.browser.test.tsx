import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "sonner";
import { SUPPORTED_LYRICS_FORMATS } from "@/domain/lyrics-file/supported-formats";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { LyricsImportModalHost } from "@/views/lyrics-import-modal/lyrics-import-modal-host";

// -- Harness ------------------------------------------------------------------

function withQueryClient(children: React.ReactNode): React.ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY } },
  });
  return (
    <QueryClientProvider client={client}>
      <Toaster />
      {children}
      <ConfirmModalHost />
    </QueryClientProvider>
  );
}

/** Drops on the modal chrome rather than the upload dropzone, so only the modal-level handler runs. */
function dropOnModalChrome(file: File): void {
  const target = [...document.querySelectorAll("dialog button")].find((node) => node.textContent === "Cancel");
  if (!target) throw new Error("modal chrome not found");
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
}

beforeEach(() => {
  useSettingsStore.setState({ confirmReplaceLyrics: false, autoExtractBackgroundVocals: false });
  useProjectStore.setState({ lines: [] });
});

afterEach(() => {
  useImportModalStore.getState().close();
});

// -- Tests --------------------------------------------------------------------

describe("LyricsImportModal QRC support", () => {
  it("accepts a QRC file dropped anywhere on the modal and imports its lines", async () => {
    const screen = await render(withQueryClient(<LyricsImportModalHost />));
    useImportModalStore.getState().open({ section: "upload" });
    await expect.poll(() => document.querySelector("dialog")).not.toBeNull();

    dropOnModalChrome(new File([WANDERLUST_QRC], "wanderlust.qrc", { type: "text/plain" }));

    await expect.element(screen.getByText(/Ready to import/i)).toBeInTheDocument();
    await screen.getByRole("button", { name: /^Import$/ }).click();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
    expect(useProjectStore.getState().agents).toHaveLength(2);
  });

  it("rejects an unparseable file dropped on the modal and names .qrc in the toast", async () => {
    await render(withQueryClient(<LyricsImportModalHost />));
    useImportModalStore.getState().open({ section: "upload" });
    await expect.poll(() => document.querySelector("dialog")).not.toBeNull();

    dropOnModalChrome(new File(["binary"], "cover.png", { type: "image/png" }));

    await expect.poll(() => document.body.textContent).toMatch(/Unsupported file type\. Use .*\.qrc/);
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  it("lists every supported format in the drag overlay copy", async () => {
    const screen = await render(withQueryClient(<LyricsImportModalHost />));
    useImportModalStore.getState().open({ section: "upload" });
    await expect.element(screen.getByText("Drop lyrics file to import")).toBeInTheDocument();

    const dialogText = document.querySelector("dialog")?.textContent ?? "";
    for (const format of SUPPORTED_LYRICS_FORMATS) expect(dialogText).toContain(format.label);
    expect(dialogText).toContain(".qrc");
  });
});
