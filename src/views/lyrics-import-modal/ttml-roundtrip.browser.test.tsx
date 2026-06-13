import { describe, expect, it } from "vitest";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { getLibraryProject } from "@/lib/library-persistence";
import { saveActiveProject } from "@/lib/library-save";
import { createProjectFromAudio } from "@/lib/create-project";
import { openLibraryProject } from "@/lib/library-resume";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { importParsedLyrics } from "@/views/lyrics-import-modal/use-import-modal-actions";
import { useProjectStore } from "@/stores/project";

const sampleWordSyncedTtml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:timeBase="media" xml:lang="en">
  <head><metadata><ttm:agent xml:id="v1" type="person"><ttm:name>Lead</ttm:name></ttm:agent></metadata></head>
  <body>
    <div>
      <p begin="00:00.000" end="00:02.500" ttm:agent="v1">
        <span begin="00:00.000" end="00:00.500">Hello</span>
        <span begin="00:00.500" end="00:01.000">world</span>
      </p>
    </div>
  </body>
</tt>`;

describe("TTML import → store → persist roundtrip", () => {
  it("preserves word timing through import and autosave", async () => {
    const file = new File(["data"], "audio.wav", { type: "audio/wav" });
    const id = await createProjectFromAudio({ kind: "file", file }, { audioBlobs });
    await openLibraryProject(id, { audioBlobs });
    const parsed = parseLyricsFile("a.ttml", sampleWordSyncedTtml);
    console.log("parsed.hasTimingData", parsed.hasTimingData);
    console.log("parsed.lines[0]", JSON.stringify(parsed.lines[0]));
    expect(parsed.hasTimingData).toBe(true);
    expect(parsed.lines[0]?.words?.length).toBeGreaterThan(0);

    await importParsedLyrics(parsed, {
      confirm: async () => true,
      agents: useProjectStore.getState().agents,
      audioDuration: 60,
      applyBackgroundExtraction: false,
      backgroundExtractionMergeStandalone: false,
      backgroundExtractionPreserveBrackets: false,
      source: { label: "test", filename: "a.ttml" },
    });
    const memLines = useProjectStore.getState().lines;
    expect(memLines[0]?.words?.length).toBeGreaterThan(0);
    expect(memLines[0]?.begin).toBeUndefined();

    await saveActiveProject();
    const persisted = await getLibraryProject(id);
    expect(persisted?.lines[0]?.words?.length).toBeGreaterThan(0);
    expect(persisted?.lines[0]?.begin).toBeUndefined();
  });

  it("survives a full reopen: save, reset memory, reopen by id", async () => {
    const file = new File(["data"], "audio.wav", { type: "audio/wav" });
    const id = await createProjectFromAudio({ kind: "file", file }, { audioBlobs });
    await openLibraryProject(id, { audioBlobs });
    const parsed = parseLyricsFile("a.ttml", sampleWordSyncedTtml);
    await importParsedLyrics(parsed, {
      confirm: async () => true,
      agents: useProjectStore.getState().agents,
      audioDuration: 60,
      applyBackgroundExtraction: false,
      backgroundExtractionMergeStandalone: false,
      backgroundExtractionPreserveBrackets: false,
      source: { label: "test", filename: "a.ttml" },
    });
    await saveActiveProject();

    await useProjectStore.getState().setActiveProject(undefined);
    expect(useProjectStore.getState().lines.length).toBe(0);

    await openLibraryProject(id, { audioBlobs });
    const lines = useProjectStore.getState().lines;
    expect(lines[0]?.words?.length).toBeGreaterThan(0);
    expect(lines[0]?.begin).toBeUndefined();
  });
});
