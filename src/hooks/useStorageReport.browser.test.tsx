import { putStem } from "@/audio/separation/stem-store";
import { useStorageReport } from "@/hooks/useStorageReport";
import { PROJECT_INDEX_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { saveProjectAudio } from "@/lib/project-audio";
import { notifyProjectIndexChanged } from "@/lib/project-index-changes";
import { createAudioFile } from "@/test/audio-fixtures";
import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

let latest: ReturnType<typeof useStorageReport>;

const ReportProbe: React.FC = () => {
  latest = useStorageReport();
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("useStorageReport", () => {
  it("reads the stem jobs, the audio with no index entry and the browser estimate", async () => {
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(16)]));
    const early = createAudioFile("early.wav");
    await saveProjectAudio("fresh", early);
    await render(<ReportProbe />);
    await expect.poll(() => latest?.stemJobs.length).toBe(1);
    expect(latest?.stemJobs[0]?.bytes).toBe(16);
    expect(latest?.unindexedAudioBytes).toBe(early.size);
    expect(latest?.estimate?.quota).toBeGreaterThan(0);
  });

  it("refreshes when a stem is stored", async () => {
    await render(<ReportProbe />);
    await expect.poll(() => latest?.stemJobs).toEqual([]);
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(16)]));
    await expect.poll(() => latest?.stemJobs.length).toBe(1);
  });

  it("refreshes when the project index changes", async () => {
    const early = createAudioFile("early.wav");
    await saveProjectAudio("fresh", early);
    await render(<ReportProbe />);
    await expect.poll(() => latest?.unindexedAudioBytes).toBe(early.size);
    await setInStore(PROJECT_INDEX_STORE_NAME, "fresh", indexEntry("fresh", { storedAudioBytes: early.size }));
    notifyProjectIndexChanged();
    await expect.poll(() => latest?.unindexedAudioBytes).toBe(0);
  });

  describe("edge cases", () => {
    it("reports an empty device", async () => {
      await render(<ReportProbe />);
      await expect.poll(() => latest?.unindexedAudioBytes).toBe(0);
      expect(latest?.stemJobs).toEqual([]);
    });
  });
});
