import { useProjectFileActions } from "@/hooks/useProjectFileActions";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { listProjectIndex } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { saveInputTitled, seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("useProjectFileActions · clear", () => {
  it("clearing deletes the open project and leaves a blank editor", async () => {
    useSettingsStore.setState({ confirmClearProject: false });
    await seedStoredProject("a", { open: true });
    await restoreOpenProject();
    const { result } = await renderHook(() => useProjectFileActions());
    await result.current.handleClearProject();
    expect(useProjectStore.getState().lines).toEqual([]);
    expect(await loadProjectRecord("a")).toBeUndefined();
    expect(openProjectIdSnapshot()).not.toBe("a");
  });

  it("clearing before anything was saved still leaves a blank editor", async () => {
    useSettingsStore.setState({ confirmClearProject: false });
    useProjectStore.getState().setMetadata({ title: "Unsaved" });
    const { result } = await renderHook(() => useProjectFileActions());
    await result.current.handleClearProject();
    expect(useProjectStore.getState().metadata.title).toBe("");
  });

  describe("error paths", () => {
    it("a failed delete keeps the click handler from rejecting and says so", async () => {
      allowConsole(/could not clear the project/);
      useSettingsStore.setState({ confirmClearProject: false });
      await seedStoredProject("a", { open: true });
      await restoreOpenProject();
      const screen = await render(<Toaster />);
      const { result } = await renderHook(() => useProjectFileActions());
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await expect(result.current.handleClearProject()).resolves.toBeUndefined();
      await expect.element(screen.getByText("Couldn't clear the project")).toBeInTheDocument();
      await deleteDatabase(DB_NAME);
    });
  });

  describe("regressions", () => {
    it("regression: clearing before anything was saved discards a pending save instead of persisting it", async () => {
      useSettingsStore.setState({ confirmClearProject: false, autoSaveDelay: 60_000 });
      debouncedSave(saveInputTitled("Unsaved"));
      const { result } = await renderHook(() => useProjectFileActions());
      await result.current.handleClearProject();
      await flushPendingSave();
      expect(await listProjectIndex()).toEqual([]);
    });
  });
});
