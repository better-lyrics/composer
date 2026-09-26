import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

// -- Constants -----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "9bZkp7q19f0";

const importedSong = {
  title: "Lovefield",
  artists: ["underscores"],
  album: "U",
  duration: 0,
  isrc: "USQE92600028",
  songwriters: ["April Harper Grey"],
};

const importedAgents = [{ id: "v1", type: "person" as const, name: "April Harper Grey" }];

// -- Helpers -------------------------------------------------------------------

function audioFile(name: string, lastModified = 1000): File {
  return new File([new Uint8Array(8)], name, { type: "audio/wav", lastModified });
}

function importWhileOtherSongLoaded() {
  useAudioStore.getState().setSource({ type: "file", file: audioFile("Other Song.wav") });
  useProjectStore.setState({ metadata: importedSong, agents: importedAgents });
  useProjectStore.getState().markSongDetailsImported();
}

async function dropFile(file: File) {
  const { result } = await renderHook(() => useLoadAudioFile());
  result.current(file);
}

async function loadVideo(videoId: string) {
  const { result } = await renderHook(() => useLoadYouTubeSource());
  result.current(videoId).catch(() => {});
}

function answerConfirm(clear: boolean) {
  useConfirmStore.getState().resolveAndClose(clear, false);
}

function confirmTitle() {
  return useConfirmStore.getState().options?.title;
}

// -- Tests ---------------------------------------------------------------------

describe("imported song details on a song swap", () => {
  beforeEach(() => {
    useConfirmStore.setState({ isOpen: false, options: null, resolve: null, queue: [] });
  });

  describe("audio file", () => {
    it("clears without asking when nothing was imported since the last load", async () => {
      useAudioStore.getState().setSource({ type: "file", file: audioFile("Other Song.wav") });
      useProjectStore.setState({ metadata: importedSong, agents: importedAgents });

      await dropFile(audioFile("Lovefield.wav"));

      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
    });

    it("asks before clearing details imported since the last load", async () => {
      importWhileOtherSongLoaded();

      await dropFile(audioFile("Lovefield.wav"));

      expect(useConfirmStore.getState().isOpen).toBe(true);
      expect(confirmTitle()).toBe("Clear the imported song details?");
      expect(useProjectStore.getState().metadata).toEqual(importedSong);
    });

    it("keeps the imported details and singer names when the user keeps them", async () => {
      importWhileOtherSongLoaded();

      await dropFile(audioFile("Lovefield.wav"));
      answerConfirm(false);

      await expect.poll(() => useProjectStore.getState().hasUnexportedImport).toBe(false);
      expect(useProjectStore.getState().metadata).toEqual(importedSong);
      expect(useProjectStore.getState().agents).toEqual(importedAgents);
    });

    it("clears the imported details when the user clears them", async () => {
      importWhileOtherSongLoaded();

      await dropFile(audioFile("Lovefield.wav"));
      answerConfirm(true);

      await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Lovefield");
      expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
      expect(useProjectStore.getState().agents).toEqual([{ id: "v1", type: "person", name: "Lead" }]);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });

    describe("edge cases", () => {
      it("does not ask when the same file is dropped again", async () => {
        importWhileOtherSongLoaded();

        await dropFile(audioFile("Other Song.wav"));

        expect(useConfirmStore.getState().isOpen).toBe(false);
        expect(useProjectStore.getState().metadata.isrc).toBe(importedSong.isrc);
      });

      it("does not ask on the first audio load", async () => {
        useAudioStore.getState().setSource(null);
        useProjectStore.setState({ metadata: importedSong, agents: importedAgents });
        useProjectStore.getState().markSongDetailsImported();

        await dropFile(audioFile("Lovefield.wav"));

        expect(useConfirmStore.getState().isOpen).toBe(false);
        expect(useProjectStore.getState().metadata.isrc).toBe(importedSong.isrc);
        expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
      });

      it("clears without asking once the prompt is turned off in settings", async () => {
        useSettingsStore.getState().set("confirmClearImportedSongDetails", false);
        importWhileOtherSongLoaded();

        await dropFile(audioFile("Lovefield.wav"));

        await expect.poll(() => useProjectStore.getState().metadata.isrc).toBeUndefined();
        expect(useConfirmStore.getState().isOpen).toBe(false);
      });

      it("ignores the answer when another file replaced the dropped one first", async () => {
        importWhileOtherSongLoaded();

        await dropFile(audioFile("Lovefield.wav"));
        useAudioStore.getState().setSource({ type: "file", file: audioFile("Third.wav") });
        answerConfirm(true);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(useProjectStore.getState().metadata).toEqual(importedSong);
      });
    });
  });

  describe("YouTube", () => {
    function importWhileVideoLoaded() {
      useAudioStore.getState().setYouTubeSource(VIDEO_ID);
      useProjectStore.setState({ metadata: importedSong, agents: importedAgents });
      useProjectStore.getState().markSongDetailsImported();
    }

    it("asks before clearing details imported since the last load", async () => {
      importWhileVideoLoaded();

      await loadVideo(OTHER_VIDEO_ID);

      expect(confirmTitle()).toBe("Clear the imported song details?");
      expect(useProjectStore.getState().metadata).toEqual(importedSong);
    });

    it("keeps the imported details when the user keeps them", async () => {
      importWhileVideoLoaded();

      await loadVideo(OTHER_VIDEO_ID);
      answerConfirm(false);

      await expect.poll(() => useProjectStore.getState().hasUnexportedImport).toBe(false);
      expect(useProjectStore.getState().metadata).toEqual(importedSong);
      expect(useProjectStore.getState().agents).toEqual(importedAgents);
    });

    it("clears the imported details when the user clears them", async () => {
      importWhileVideoLoaded();

      await loadVideo(OTHER_VIDEO_ID);
      answerConfirm(true);

      await expect.poll(() => useProjectStore.getState().metadata.title).toBe(OTHER_VIDEO_ID);
      expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
    });

    describe("regressions", () => {
      it("regression: a load that fails after the user cleared restores the imported details", async () => {
        importWhileVideoLoaded();
        const previousSource = useAudioStore.getState().source;

        await loadVideo(OTHER_VIDEO_ID);
        answerConfirm(true);
        await expect.poll(() => useProjectStore.getState().metadata.title).toBe(OTHER_VIDEO_ID);
        useAudioStore.getState().setSource(previousSource);
        useAudioStore.getState().setYouTubeLoadError("Could not load that video. Try again.");

        await expect.poll(() => useProjectStore.getState().metadata).toEqual(importedSong);
        expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
      });

      it("regression: a load that fails before the user answers leaves the imported details alone", async () => {
        importWhileVideoLoaded();
        const previousSource = useAudioStore.getState().source;

        await loadVideo(OTHER_VIDEO_ID);
        useAudioStore.getState().setSource(previousSource);
        useAudioStore.getState().setYouTubeLoadError("Could not load that video. Try again.");
        answerConfirm(true);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(useProjectStore.getState().metadata).toEqual(importedSong);
        expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
      });
    });
  });

  describe("invariants", () => {
    it("an export clears the flag so the next swap clears without asking", async () => {
      importWhileOtherSongLoaded();
      useProjectStore.getState().clearUnexportedImport();

      await dropFile(audioFile("Lovefield.wav"));

      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
    });

    it("a new project starts with no unexported import", () => {
      useProjectStore.getState().markSongDetailsImported();
      useProjectStore.getState().reset();
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
    });
  });
});
