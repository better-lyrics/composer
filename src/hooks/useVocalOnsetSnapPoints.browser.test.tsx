import { getStemJobOnsets, putStem, putStemJobOnsets, stemJobKey } from "@/audio/separation/stem-store";
import { useVocalOnsetSnapPoints } from "@/hooks/useVocalOnsetSnapPoints";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { resetAllStores } from "@/test/stores";
import { bufferToBlobUrl, createAudioFile, encodeWav, makeSineBuffer, makeVocalBurstBuffer } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const createdObjectUrls: string[] = [];

function createDecodableVocalsUrl(durationSeconds = 0.4): string {
  const url = bufferToBlobUrl(makeSineBuffer(durationSeconds));
  createdObjectUrls.push(url);
  return url;
}

function createBurstVocalsUrl(durationSeconds: number): string {
  const url = bufferToBlobUrl(makeVocalBurstBuffer(durationSeconds));
  createdObjectUrls.push(url);
  return url;
}

function createUnreadableUrl(): string {
  const url = bufferToBlobUrl(makeSineBuffer(0.2));
  URL.revokeObjectURL(url);
  return url;
}

async function storeSeparatedJob(hash: string): Promise<string> {
  const stem = new Blob([encodeWav(makeSineBuffer(0.2))], { type: "audio/wav" });
  await putStem(hash, "vocals", "fp32", stem);
  await putStem(hash, "instrumental", "fp32", stem);
  return stemJobKey(hash, "fp32");
}

function recordDetectionStatuses(): string[] {
  const seen: string[] = [];
  useTimelineStore.subscribe((state, prev) => {
    if (state.vocalOnsetDetectionStatus !== prev.vocalOnsetDetectionStatus) seen.push(state.vocalOnsetDetectionStatus);
  });
  return seen;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    it("regression: clears user-placed custom snap points when the audio source changes", async () => {
      await render(<HookHarness />);

      useProjectStore.getState().setCustomSnapPoints([2, 4, 6]);
      expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([2, 4, 6]);

      useAudioStore.setState({ source: { type: "file", file: createAudioFile("another-song.wav") } });

      await expect.poll(() => useProjectStore.getState().customSnapPoints).toEqual([]);
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

  describe("setting gate", () => {
    it("does no work while snapping to vocal onsets is off", async () => {
      useSettingsStore.getState().set("vocalOnsetSnap", false);
      const statuses = recordDetectionStatuses();
      await render(<HookHarness />);

      useSeparationStore.setState({ stemUrls: { vocals: createUnreadableUrl() } });
      await settle(300);

      expect(statuses).toEqual([]);
      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
    });

    it("detects on demand once the setting is turned on", async () => {
      useSettingsStore.getState().set("vocalOnsetSnap", false);
      await render(<HookHarness />);
      useSeparationStore.setState({ stemUrls: { vocals: createBurstVocalsUrl(2) } });
      await settle(100);
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);

      useSettingsStore.getState().set("vocalOnsetSnap", true);

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints.length).toBeGreaterThan(2);
      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
    });

    it("cancels a running detection when the setting is turned off", async () => {
      await render(<HookHarness />);
      useSeparationStore.setState({ stemUrls: { vocals: createBurstVocalsUrl(60) } });
      await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("processing");

      useSettingsStore.getState().set("vocalOnsetSnap", false);

      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
      await settle(1500);
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);
    });
  });

  describe("onset cache", () => {
    it("stores detected onsets with the stem job", async () => {
      const jobKey = await storeSeparatedJob("cache-a");
      await render(<HookHarness />);

      useSeparationStore.setState({ jobKey, stemUrls: { vocals: createBurstVocalsUrl(2) } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints.length).toBeGreaterThan(2);
      await expect.poll(() => getStemJobOnsets(jobKey)).toEqual(useTimelineStore.getState().vocalOnsetSnapPoints);
    });

    it("reuses cached onsets without reading the stem or showing detection", async () => {
      const jobKey = await storeSeparatedJob("cache-b");
      await putStemJobOnsets(jobKey, [0.5, 1.5, 2.5]);
      const statuses = recordDetectionStatuses();
      await render(<HookHarness />);

      useSeparationStore.setState({ jobKey, stemUrls: { vocals: createUnreadableUrl() } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([0.5, 1.5, 2.5]);
      expect(statuses).toEqual([]);
      expect(useTimelineStore.getState().vocalOnsetDetectionError).toBeNull();
    });
  });

  describe("stale results", () => {
    it("never applies onsets from a song that was replaced during detection", async () => {
      const jobKey = await storeSeparatedJob("stale-a");
      await render(<HookHarness />);
      useSeparationStore.setState({ jobKey, stemUrls: { vocals: createBurstVocalsUrl(60) } });
      await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("processing");

      useAudioStore.setState({ source: { type: "file", file: createAudioFile("replacement.wav") } });

      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
      await settle(1500);
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([]);
      expect(await getStemJobOnsets(jobKey)).toBeNull();
    });

    it("applies only the newest stem when the vocals url changes during detection", async () => {
      await render(<HookHarness />);
      useSeparationStore.setState({ stemUrls: { vocals: createBurstVocalsUrl(60) } });
      await expect.poll(() => useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("processing");

      useSeparationStore.setState({ stemUrls: { vocals: createBurstVocalsUrl(2) } });

      await expect.poll(() => useTimelineStore.getState().vocalOnsetSnapPoints.length).toBeGreaterThan(2);
      await settle(1500);
      expect(Math.max(...useTimelineStore.getState().vocalOnsetSnapPoints)).toBeLessThan(2);
    });
  });
});
