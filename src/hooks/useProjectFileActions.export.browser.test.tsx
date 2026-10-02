import { useProjectFileActions } from "@/hooks/useProjectFileActions";
import { restoreOpenProject } from "@/lib/open-project";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

describe("useProjectFileActions · export", () => {
  it("downloads the open project as a project file", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    await restoreOpenProject();
    const added: HTMLAnchorElement[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement) added.push(node);
      }
    });
    observer.observe(document.body, { childList: true });
    const { result } = await renderHook(() => useProjectFileActions());
    result.current.handleExportProject();
    await expect.poll(() => added.length).toBe(1);
    observer.disconnect();
    expect(added[0]?.download).toMatch(/^Alpha-/);
  });
});
