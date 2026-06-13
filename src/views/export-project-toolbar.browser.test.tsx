import { describe, expect, it, vi } from "vitest";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { getLibraryProject } from "@/lib/library-persistence";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { seedLibraryProject } from "@/test/idb";
import { render } from "@/test/render";
import { ExportProjectToolbar } from "@/views/export-project-toolbar";

describe("ExportProjectToolbar", () => {
  const noop = () => {};

  it("renders the three project actions", async () => {
    const screen = await render(<ExportProjectToolbar onImportClick={noop} />);
    await expect.element(screen.getByRole("button", { name: /Import Project/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Export Project/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /^Clear$/ })).toBeInTheDocument();
  });

  it("invokes onImportClick when Import Project is clicked", async () => {
    const onImport = vi.fn();
    const screen = await render(<ExportProjectToolbar onImportClick={onImport} />);
    await screen.getByRole("button", { name: /Import Project/ }).click();
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  describe("Clear", () => {
    it("deletes the active library record, its audio bytes, and routes to the library", async () => {
      const id = "toolbar-clear-1";
      await seedLibraryProject(id);
      await audioBlobs.put(id, new Uint8Array([1, 2, 3]).buffer);
      useProjectStore.setState({ activeProjectId: id });
      useUIStore.setState({ viewingLibrary: false });
      useConfirmStore.setState({ open: vi.fn().mockResolvedValue(true) });

      const screen = await render(<ExportProjectToolbar onImportClick={noop} />);
      await screen.getByRole("button", { name: /^Clear$/ }).click();

      await expect.poll(() => getLibraryProject(id)).toBeUndefined();
      expect(await audioBlobs.has(id)).toBe(false);
      expect(useProjectStore.getState().activeProjectId).toBeUndefined();
      expect(useUIStore.getState().viewingLibrary).toBe(true);
    });

    it("does nothing when the confirm prompt is cancelled", async () => {
      const id = "toolbar-clear-2";
      await seedLibraryProject(id);
      await audioBlobs.put(id, new Uint8Array([4, 5, 6]).buffer);
      useProjectStore.setState({ activeProjectId: id });
      useUIStore.setState({ viewingLibrary: false });
      useConfirmStore.setState({ open: vi.fn().mockResolvedValue(false) });

      const screen = await render(<ExportProjectToolbar onImportClick={noop} />);
      await screen.getByRole("button", { name: /^Clear$/ }).click();

      expect(await getLibraryProject(id)).toBeDefined();
      expect(await audioBlobs.has(id)).toBe(true);
      expect(useProjectStore.getState().activeProjectId).toBe(id);
      expect(useUIStore.getState().viewingLibrary).toBe(false);
    });

    it("resets in-memory state even when there is no active project id", async () => {
      useProjectStore.setState({
        activeProjectId: undefined,
        metadata: { title: "Ephemeral", artist: "", album: "", duration: 0 },
      });
      useUIStore.setState({ viewingLibrary: false });
      useConfirmStore.setState({ open: vi.fn().mockResolvedValue(true) });

      const screen = await render(<ExportProjectToolbar onImportClick={noop} />);
      await screen.getByRole("button", { name: /^Clear$/ }).click();

      await expect.poll(() => useProjectStore.getState().metadata.title).toBe("");
      expect(useUIStore.getState().viewingLibrary).toBe(true);
    });
  });
});
