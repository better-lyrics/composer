import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { usePersistence } from "@/hooks/usePersistence";
import { useResolveYouTubeTunnel } from "@/hooks/useResolveYouTubeTunnel";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { awaitInFlightSaves } from "@/lib/save-status";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { type FakeBridge, installFakeBridge } from "@/test/fake-bridge";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

const AppHost: React.FC = () => {
  usePersistence();
  useResolveYouTubeTunnel();
  return null;
};

let bridge: FakeBridge;

async function openYouTubeProject(): Promise<void> {
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: VIDEO_ID } },
  });
  await render(<AppHost />);
  await getPersistenceSettled();
}

// -- Setup --------------------------------------------------------------------

beforeEach(() => {
  bridge = installFakeBridge();
  useSettingsStore.setState({ experiments: { youtubeBridge: true }, composerBridgeUrl: DEFAULT_BRIDGE_URL });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -- Tests --------------------------------------------------------------------

describe("opening a YouTube project with Composer Bridge on", () => {
  it("fetches the audio through the bridge once and does not store it", async () => {
    bridge.serveAudio(VIDEO_ID, new TextEncoder().encode("opus bytes").buffer);
    await openYouTubeProject();
    await expect.poll(() => useAudioStore.getState().expectedAudio).toBeNull();
    const source = useAudioStore.getState().source;
    expect(source?.type === "youtube" && source.file !== undefined).toBe(true);
    expect(bridge.audioCalls).toEqual([VIDEO_ID]);
    await awaitInFlightSaves();
    expect(await loadProjectAudio("p")).toBeUndefined();
    expect(useProjectStore.getState().metadata.title).toBe("Song");
  });

  it("marks the failure as an unreachable bridge and keeps the project's video", async () => {
    allowConsole(/tunnel fetch failed/);
    bridge.goOffline();
    await openYouTubeProject();
    await expect.poll(() => useAudioStore.getState().youtubeLoadFailure).toBe("bridge-unreachable");
    expect(useAudioStore.getState().source).toBeNull();
    expect(useAudioStore.getState().expectedAudio).toEqual({ kind: "youtube", videoId: VIDEO_ID });
  });

  describe("edge cases", () => {
    it("marks a bridge that answers with an error as a fetch failure", async () => {
      allowConsole(/tunnel fetch failed/);
      await openYouTubeProject();
      await expect.poll(() => useAudioStore.getState().youtubeLoadFailure).toBe("fetch-failed");
    });
  });

  describe("regressions", () => {
    it("regression: an edit after a failed fetch keeps the project's video id", async () => {
      allowConsole(/tunnel fetch failed/);
      bridge.goOffline();
      await openYouTubeProject();
      await expect.poll(() => useAudioStore.getState().youtubeLoadFailure).toBe("bridge-unreachable");
      useProjectStore.getState().setMetadata({ title: "Song (edited)" });
      await flushPendingSave();
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "youtube", videoId: VIDEO_ID });
    });

    it("regression: a failed replacement load keeps the missing file's identity in the saved record", async () => {
      allowConsole(/tunnel fetch failed/);
      await seedStoredProject("p", {
        open: true,
        project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
      });
      await render(<AppHost />);
      await getPersistenceSettled();
      bridge.goOffline();

      const { result } = await renderHook(() => useLoadYouTubeSource());
      await expect(result.current(VIDEO_ID)).rejects.toThrow();

      useProjectStore.getState().setMetadata({ title: "City (edited)" });
      await flushPendingSave();
      expect((await loadProjectRecord("p"))?.audioSource).toEqual({ kind: "file", name: "city.wav" });
    });
  });
});
