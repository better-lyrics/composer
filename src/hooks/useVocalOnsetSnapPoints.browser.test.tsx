import { useVocalOnsetSnapPoints } from "@/hooks/useVocalOnsetSnapPoints";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { resetAllStores } from "@/test/stores";
import { bufferToBlobUrl, createAudioFile, makeSineBuffer } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const createdObjectUrls: string[] = [];

function createDecodableVocalsUrl(durationSeconds = 0.4): string {
  const url = bufferToBlobUrl(makeSineBuffer(durationSeconds));
  createdObjectUrls.push(url);
  return url;
}

const HookHarness: React.FC = () => {
  useVocalOnsetSnapPoints();
  return null;
};

describe("useVocalOnsetSnapPoints", () => {
  beforeEach(async () => {
    await resetAllStores();
  });

  afterEach(() => {
    while (createdObjectUrls.length > 0) {
      const url = createdObjectUrls.pop();
      if (url) URL.revokeObjectURL(url);
    }
  });

  it("runs detection when a vocals stem url appears and returns to idle", async () => {
    await render(<HookHarness />);

    useSeparationStore.setState({ stemUrls: { vocals: createDecodableVocalsUrl() } });

    await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
    expect(Array.isArray(useTimelineStore.getState().vocalOnsetSnapPoints)).toBe(true);
    expect(useTimelineStore.getState().vocalOnsetDetectionError).toBeNull();
  });

  describe("regressions", () => {
    it("regression: clears stale onset points when the audio source changes", async () => {
      await render(<HookHarness />);

      useTimelineStore.getState().setVocalOnsetSnapPoints([1, 2, 3]);
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([1, 2, 3]);

      useAudioStore.setState({ source: { type: "file", file: createAudioFile("next-song.wav") } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);
      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
    });

    it("regression: clears stale onset points when switching between file-less youtube sources", async () => {
      await render(<HookHarness />);

      useAudioStore.setState({ source: { type: "youtube", videoId: "video-a" } });
      useTimelineStore.getState().setVocalOnsetSnapPoints([1, 2, 3]);
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([1, 2, 3]);

      useAudioStore.setState({ source: { type: "youtube", videoId: "video-b" } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);
      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
    });
  });

  it("clears points when the vocals url is removed", async () => {
    await render(<HookHarness />);

    useSeparationStore.setState({ stemUrls: { vocals: createDecodableVocalsUrl() } });
    await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");

    useTimelineStore.getState().setVocalOnsetSnapPoints([4, 5, 6]);
    useSeparationStore.setState({ stemUrls: {} });

    await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);
    expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
  });

  describe("error paths", () => {
    it("sets an error status when the vocals url cannot be fetched or decoded", async () => {
      await render(<HookHarness />);

      const revokedUrl = bufferToBlobUrl(makeSineBuffer(0.2));
      URL.revokeObjectURL(revokedUrl);

      useSeparationStore.setState({ stemUrls: { vocals: revokedUrl } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("error");
      expect(useTimelineStore.getState().vocalOnsetDetectionError).toBeTruthy();
      expect(Array.isArray(useTimelineStore.getState().vocalOnsetSnapPoints)).toBe(true);
    });
  });

  describe("invariants", () => {
    it("reflects only the latest vocals url when switched mid-flight", async () => {
      await render(<HookHarness />);

      const firstUrl = createDecodableVocalsUrl(0.5);
      const secondUrl = createDecodableVocalsUrl(0.3);

      useSeparationStore.setState({ stemUrls: { vocals: firstUrl } });
      useSeparationStore.setState({ stemUrls: { vocals: secondUrl } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
      expect(useTimelineStore.getState().vocalOnsetDetectionError).toBeNull();
    });
  });
});
