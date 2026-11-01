import { useImportFromLinkedFiles } from "@/hooks/useImportFromLinkedFiles";
import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { usePersistence } from "@/hooks/usePersistence";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { getLinkedFilesSettled, getPersistenceSettled, getQueryImportSettled } from "@/lib/persistence-settled";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const FIXTURES = `${window.location.origin}/src/test/fixtures`;
const AUDIO_URL = `${FIXTURES}/linked-song.wav`;
const LYRICS_URL = `${FIXTURES}/linked.lrc`;
const MISSING_AUDIO_URL = `${FIXTURES}/missing-song.wav`;

// -- Helpers ------------------------------------------------------------------

const LinkHost: React.FC = () => {
  usePersistence();
  useImportFromLinkedFiles();
  useImportFromQuery();
  return <Toaster />;
};

function setQuery(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function linkQuery(params: Record<string, string>): string {
  return `?${new URLSearchParams(params).toString()}`;
}

async function seedOpenAlpha(lyrics: boolean): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("alpha.wav"),
    project: {
      ...songTitled("Alpha"),
      ...(lyrics ? {} : { lines: [] }),
      audioSource: { kind: "file", name: "alpha.wav" },
    },
  });
}

async function waitForLinkSettled(): Promise<void> {
  await getPersistenceSettled();
  await getLinkedFilesSettled();
  await getQueryImportSettled();
}

function loadedFileName(): string | null {
  const source = useAudioStore.getState().source;
  return source?.type === "file" ? source.file.name : null;
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromLinkedFiles", () => {
  beforeEach(() => setQuery(""));
  afterEach(() => setQuery(""));

  it("opens audio, lyrics and link details in a new project when the open one has lyrics", async () => {
    await seedOpenAlpha(true);
    setQuery(linkQuery({ audioUrl: AUDIO_URL, lyricsUrl: LYRICS_URL, title: "Linked Title", artist: "Linked Artist" }));

    await render(<LinkHost />);
    await waitForLinkSettled();

    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(loadedFileName()).toBe("linked-song.wav");
    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual([
      "First linked line",
      "Second linked line",
    ]);
    expect(useProjectStore.getState().metadata.title).toBe("Linked Title");
    expect(useProjectStore.getState().metadata.artists).toEqual(["Linked Artist"]);
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
    expect(window.location.search).toBe("");
  });

  it("loads the audio in place when the open project has no lyrics", async () => {
    await seedOpenAlpha(false);
    setQuery(linkQuery({ audioUrl: AUDIO_URL }));

    await render(<LinkHost />);
    await waitForLinkSettled();

    expect(openProjectIdSnapshot()).toBe("a");
    expect(loadedFileName()).toBe("linked-song.wav");
  });

  it("leaves the open project alone when the audio download fails", async () => {
    allowConsole(/404/);
    await seedOpenAlpha(true);
    setQuery(linkQuery({ audioUrl: MISSING_AUDIO_URL, title: "Linked Title" }));

    await render(<LinkHost />);
    await waitForLinkSettled();

    expect(openProjectIdSnapshot()).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    expect(loadedFileName()).toBe("alpha.wav");
  });
});
