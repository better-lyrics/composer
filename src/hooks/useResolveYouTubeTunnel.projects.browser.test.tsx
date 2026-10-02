import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { usePersistence } from "@/hooks/usePersistence";
import { useResolveYouTubeTunnel } from "@/hooks/useResolveYouTubeTunnel";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { loadProjectAudio } from "@/lib/project-audio";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { installFakeBridge } from "@/test/fake-bridge";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

const PersistenceAndTunnelHost: React.FC = () => {
  usePersistence();
  useResolveYouTubeTunnel();
  return null;
};

function queryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

async function openAlphaWithTunnel(): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("alpha.wav"),
    project: { ...songTitled("Alpha"), audioSource: { kind: "file", name: "alpha.wav" } },
  });
  await render(
    <QueryClientProvider client={queryClient()}>
      <PersistenceAndTunnelHost />
    </QueryClientProvider>,
  );
  await getPersistenceSettled();
}

// -- Tests --------------------------------------------------------------------

describe("useResolveYouTubeTunnel · projects", () => {
  beforeEach(() => {
    useSettingsStore.setState({ experiments: { youtubeBridge: true }, composerBridgeUrl: DEFAULT_BRIDGE_URL });
    installFakeBridge();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("regressions", () => {
    it("regression: a failed load in a kept new project never saves the previous project's audio into it", async () => {
      allowConsole(/tunnel fetch failed/);
      await openAlphaWithTunnel();
      const { result } = await renderHook(() => useLoadYouTubeSource());
      const loading = result.current(VIDEO_ID);
      const newId = openProjectIdSnapshot() ?? "";
      expect(newId).not.toBe("a");
      useProjectStore.getState().setLines([{ id: "n1", text: "New words", agentId: "v1" }]);
      await expect(loading).rejects.toThrow();
      expect(useAudioStore.getState().source).toBeNull();
      await flushPendingSave();
      await expect.poll(getSaveStatus).toBe("saved");
      expect(await loadProjectAudio(newId)).toBeUndefined();
      expect((await loadProjectAudio("a"))?.name).toBe("alpha.wav");
    });
  });
});
