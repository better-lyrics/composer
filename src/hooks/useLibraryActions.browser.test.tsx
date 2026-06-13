import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderHook } from "vitest-browser-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import {
  deleteLibraryProject,
  getLibraryProject,
  listLibraryProjects,
  putLibraryProject,
} from "@/lib/library-persistence";
import { saveActiveProject } from "@/lib/library-save";
import { debouncedSave } from "@/lib/persistence-debounce";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function makeProject(overrides: Partial<LibraryProject> & Pick<LibraryProject, "id">): LibraryProject {
  return {
    version: 1,
    metadata: { title: `Title-${overrides.id}`, artist: "Artist", album: "", duration: 100 },
    agents: [],
    lines: [],
    groups: [],
    granularity: "word",
    syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
    audioBytesCached: false,
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    currentStem: "original",
    createdAt: 1000,
    updatedAt: 1000,
    lastOpenedAt: 1000,
    ...overrides,
  };
}

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function clearLibrary(): Promise<void> {
  const projects = await listLibraryProjects();
  for (const p of projects) {
    await deleteLibraryProject(p.id);
    await audioBlobs.delete(p.id);
  }
}

const STUB_BYTES = new Uint8Array([1, 2, 3, 4]).buffer;

beforeEach(async () => {
  await clearLibrary();
});

afterEach(async () => {
  await clearLibrary();
});

// -- Tests --------------------------------------------------------------------

describe("useLibraryActions.rename", () => {
  it("renames a project to the new title", async () => {
    await putLibraryProject(makeProject({ id: "r-1", metadata: { title: "Old", artist: "", album: "", duration: 0 } }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.rename("r-1", "New title");
    const stored = await getLibraryProject("r-1");
    expect(stored?.metadata.title).toBe("New title");
  });

  it("trims whitespace from the new title", async () => {
    await putLibraryProject(makeProject({ id: "r-2", metadata: { title: "Old", artist: "", album: "", duration: 0 } }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.rename("r-2", "  Trimmed  ");
    const stored = await getLibraryProject("r-2");
    expect(stored?.metadata.title).toBe("Trimmed");
  });

  it("ignores an empty title and keeps the original", async () => {
    await putLibraryProject(
      makeProject({ id: "r-3", metadata: { title: "Keep", artist: "", album: "", duration: 0 } }),
    );
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.rename("r-3", "");
    const stored = await getLibraryProject("r-3");
    expect(stored?.metadata.title).toBe("Keep");
  });

  it("ignores a whitespace-only title", async () => {
    await putLibraryProject(
      makeProject({ id: "r-4", metadata: { title: "Keep", artist: "", album: "", duration: 0 } }),
    );
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.rename("r-4", "   ");
    const stored = await getLibraryProject("r-4");
    expect(stored?.metadata.title).toBe("Keep");
  });

  it("is a no-op for unknown project ids", async () => {
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
    await result.current.rename("nope", "Hello");
  });
});

describe("useLibraryActions.duplicate", () => {
  it("duplicates a project with a unique id", async () => {
    await putLibraryProject(makeProject({ id: "dup-1" }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const newId = await result.current.duplicate("dup-1");
    expect(newId).toBeDefined();
    expect(newId).not.toBe("dup-1");

    const list = await listLibraryProjects();
    expect(list.length).toBe(2);
  });

  it("appends ' (copy)' to the title", async () => {
    await putLibraryProject(
      makeProject({ id: "dup-2", metadata: { title: "Song", artist: "A", album: "", duration: 0 } }),
    );
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const newId = await result.current.duplicate("dup-2");
    const copy = newId ? await getLibraryProject(newId) : undefined;
    expect(copy?.metadata.title).toBe("Song (copy)");
  });

  it("copies cached audio bytes to the new project", async () => {
    await putLibraryProject(makeProject({ id: "dup-3", audioBytesCached: true }));
    await audioBlobs.put("dup-3", STUB_BYTES);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const newId = await result.current.duplicate("dup-3");
    expect(newId).toBeDefined();
    if (!newId) return;
    const copyBytes = await audioBlobs.get(newId);
    expect(copyBytes).toBeDefined();
    expect(copyBytes?.byteLength).toBe(STUB_BYTES.byteLength);

    const copy = await getLibraryProject(newId);
    expect(copy?.audioBytesCached).toBe(true);
  });

  it("flips audioBytesCached to false when the flag was true but bytes are missing", async () => {
    await putLibraryProject(makeProject({ id: "dup-4", audioBytesCached: true }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const newId = await result.current.duplicate("dup-4");
    expect(newId).toBeDefined();
    if (!newId) return;
    const copy = await getLibraryProject(newId);
    expect(copy?.audioBytesCached).toBe(false);
  });

  it("resets pinned to false on the duplicate", async () => {
    await putLibraryProject(makeProject({ id: "dup-5", pinned: true }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const newId = await result.current.duplicate("dup-5");
    expect(newId).toBeDefined();
    if (!newId) return;
    const copy = await getLibraryProject(newId);
    expect(copy?.pinned).toBe(false);
  });

  it("is a no-op for unknown project ids", async () => {
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
    const newId = await result.current.duplicate("missing");
    expect(newId).toBeUndefined();
  });
});

describe("useLibraryActions.togglePin", () => {
  it("toggles pinned from false to true", async () => {
    await putLibraryProject(makeProject({ id: "pin-1", pinned: false }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.togglePin("pin-1");
    expect((await getLibraryProject("pin-1"))?.pinned).toBe(true);
  });

  it("toggles pinned from true to false", async () => {
    await putLibraryProject(makeProject({ id: "pin-2", pinned: true }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.togglePin("pin-2");
    expect((await getLibraryProject("pin-2"))?.pinned).toBe(false);
  });

  it("the change is visible in listLibraryProjects pinned-first order", async () => {
    await putLibraryProject(makeProject({ id: "p-a", lastOpenedAt: 10 }));
    await putLibraryProject(makeProject({ id: "p-b", lastOpenedAt: 20 }));
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.togglePin("p-a");
    const list = await listLibraryProjects();
    expect(list[0].id).toBe("p-a");
  });
});

describe("useLibraryActions.delete", () => {
  it("opens a confirmation modal", async () => {
    await putLibraryProject(makeProject({ id: "del-1" }));
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-1");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(false, false);
    expect(await promise).toBe(false);
  });

  it("returns false and is a no-op when the user cancels", async () => {
    await putLibraryProject(makeProject({ id: "del-2" }));
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-2");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(false, false);
    expect(await promise).toBe(false);

    expect(await getLibraryProject("del-2")).toBeDefined();
  });

  it("removes the project from the library on confirm", async () => {
    await putLibraryProject(makeProject({ id: "del-3" }));
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-3");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(true, false);
    expect(await promise).toBe(true);

    expect(await getLibraryProject("del-3")).toBeUndefined();
  });

  it("removes the audio bytes from OPFS on confirm", async () => {
    await putLibraryProject(makeProject({ id: "del-4", audioBytesCached: true }));
    await audioBlobs.put("del-4", STUB_BYTES);
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-4");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(true, false);
    await promise;

    expect(await audioBlobs.has("del-4")).toBe(false);
  });

  it("clears active project + enters library view when the active project is deleted", async () => {
    await putLibraryProject(makeProject({ id: "del-5" }));
    useProjectStore.setState({ activeProjectId: "del-5" });
    useUIStore.setState({ viewingLibrary: false });
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-5");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(true, false);
    await promise;

    expect(useProjectStore.getState().activeProjectId).toBeUndefined();
    expect(useUIStore.getState().viewingLibrary).toBe(true);
  });

  it("does not affect active project when a different project is deleted", async () => {
    await putLibraryProject(makeProject({ id: "del-6" }));
    await putLibraryProject(makeProject({ id: "keeper" }));
    useProjectStore.setState({ activeProjectId: "keeper" });
    useUIStore.setState({ viewingLibrary: false });
    await render(<ConfirmModalHost />);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    const promise = result.current.delete("del-6");
    await expect.poll(() => useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(true, false);
    await promise;

    expect(useProjectStore.getState().activeProjectId).toBe("keeper");
    expect(useUIStore.getState().viewingLibrary).toBe(false);
  });
});

describe("useLibraryActions.evictAudio", () => {
  it("removes audio bytes from OPFS and flips audioBytesCached to false", async () => {
    await putLibraryProject(
      makeProject({
        id: "ev-1",
        audioSource: { kind: "youtube", videoId: "v1" },
        audioBytesCached: true,
      }),
    );
    await audioBlobs.put("ev-1", STUB_BYTES);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.evictAudio("ev-1");
    expect(await audioBlobs.has("ev-1")).toBe(false);
    const stored = await getLibraryProject("ev-1");
    expect(stored?.audioBytesCached).toBe(false);
  });

  it("is a no-op for file-source projects", async () => {
    await putLibraryProject(
      makeProject({
        id: "ev-2",
        audioSource: { kind: "file", name: "song.mp3" },
        audioBytesCached: true,
      }),
    );
    await audioBlobs.put("ev-2", STUB_BYTES);
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.evictAudio("ev-2");
    expect(await audioBlobs.has("ev-2")).toBe(true);
    const stored = await getLibraryProject("ev-2");
    expect(stored?.audioBytesCached).toBe(true);
  });

  it("is a no-op for unknown project ids", async () => {
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
    await result.current.evictAudio("missing");
  });
});

describe("useLibraryActions exports", () => {
  let createSpy: ReturnType<typeof vi.spyOn>;
  let revokeSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("exportTtml triggers a download for the given project id", async () => {
    await putLibraryProject(
      makeProject({ id: "exp-1", metadata: { title: "Song", artist: "A", album: "", duration: 0 } }),
    );
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.exportTtml("exp-1");
    expect(createSpy).toHaveBeenCalledTimes(1);
    const [blobArg] = createSpy.mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect((blobArg as Blob).type).toContain("application/ttml+xml");
  });

  it("exportTtml is a no-op when the project does not exist", async () => {
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
    await result.current.exportTtml("nope");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("exportProjectJson triggers a download with the correct filename pattern", async () => {
    let downloadName: string | undefined;
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    await putLibraryProject(
      makeProject({ id: "exp-2", metadata: { title: "MyTitle", artist: "A", album: "", duration: 0 } }),
    );
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });

    await result.current.exportProjectJson("exp-2");
    expect(createSpy).toHaveBeenCalledTimes(1);

    const datePart = new Date().toISOString().slice(0, 10);
    expect(downloadName).toBe(`MyTitle-${datePart}.ttml-project.json`);
  });

  it("exportProjectJson is a no-op when the project does not exist", async () => {
    const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
    await result.current.exportProjectJson("nope");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("flushes pending saves before reading the active project for TTML export", async () => {
    try {
      await putLibraryProject(
        makeProject({ id: "flush-ttml", metadata: { title: "Stale", artist: "", album: "", duration: 0 } }),
      );
      useProjectStore.setState({ activeProjectId: "flush-ttml" });
      useSettingsStore.getState().set("autoSaveDelay", 100000);
      useProjectStore.getState().setMetadata({ title: "Fresh" });
      debouncedSave(() => saveActiveProject());

      const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
      await result.current.exportTtml("flush-ttml");

      const persisted = await getLibraryProject("flush-ttml");
      expect(persisted?.metadata.title).toBe("Fresh");
    } finally {
      useSettingsStore.getState().set("autoSaveDelay", 2000);
      useProjectStore.setState({ activeProjectId: undefined });
    }
  });

  it("flushes pending saves before reading the active project for JSON export", async () => {
    try {
      await putLibraryProject(
        makeProject({ id: "flush-json", metadata: { title: "Stale", artist: "", album: "", duration: 0 } }),
      );
      useProjectStore.setState({ activeProjectId: "flush-json" });
      useSettingsStore.getState().set("autoSaveDelay", 100000);
      useProjectStore.getState().setMetadata({ title: "Fresh" });
      debouncedSave(() => saveActiveProject());

      const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
      await result.current.exportProjectJson("flush-json");

      const persisted = await getLibraryProject("flush-json");
      expect(persisted?.metadata.title).toBe("Fresh");
    } finally {
      useSettingsStore.getState().set("autoSaveDelay", 2000);
      useProjectStore.setState({ activeProjectId: undefined });
    }
  });

  it("does not flush when exporting a non-active project", async () => {
    try {
      await putLibraryProject(
        makeProject({ id: "active", metadata: { title: "Active stale", artist: "", album: "", duration: 0 } }),
      );
      await putLibraryProject(
        makeProject({ id: "other", metadata: { title: "Other", artist: "", album: "", duration: 0 } }),
      );
      useProjectStore.setState({ activeProjectId: "active" });
      useSettingsStore.getState().set("autoSaveDelay", 100000);
      useProjectStore.getState().setMetadata({ title: "Active fresh" });
      debouncedSave(() => saveActiveProject());

      const { result } = await renderHook(() => useLibraryActions(), { wrapper: buildWrapper() });
      await result.current.exportTtml("other");

      const persistedActive = await getLibraryProject("active");
      expect(persistedActive?.metadata.title).toBe("Active stale");
    } finally {
      useSettingsStore.getState().set("autoSaveDelay", 2000);
      useProjectStore.setState({ activeProjectId: undefined });
    }
  });
});
