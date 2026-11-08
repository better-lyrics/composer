import { describe, expect, it } from "vitest";
import { saveProjectRecord } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { undoAddedLyrics } from "@/lib/unison/add-unison-lyrics";
import { seedStoredProject, songTitled } from "@/test/projects";

// -- Tests --------------------------------------------------------------------

describe("undoAddedLyrics", () => {
  it("regression: Undo never deletes an added project that was edited after it was added", async () => {
    const added = await seedStoredProject("lanterns", { project: songTitled("Paper Lanterns") });
    const edited = await seedStoredProject("harbor", { project: songTitled("Harbor Lights") });
    await saveProjectRecord("harbor", {
      ...edited,
      savedAt: edited.savedAt + 1,
      metadata: songTitled("Harbor").metadata,
    });

    const kept = await undoAddedLyrics({
      created: [
        { id: "lanterns", savedAt: added.savedAt },
        { id: "harbor", savedAt: edited.savedAt },
      ],
      linked: [],
    });

    expect(kept).toBe(1);
    expect(await loadProjectRecord("lanterns")).toBeUndefined();
    expect((await loadProjectRecord("harbor"))?.metadata.title).toBe("Harbor");
  });
});
