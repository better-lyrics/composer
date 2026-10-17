import { storedAudioBytesTotal } from "@/domain/project/audio-status";
import { hasClearableStems, oldestStemJobFirst, storageUsage } from "@/domain/storage/usage";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

const ENTRIES = [
  indexEntry("file", { audioKind: "file", storedAudioBytes: 400, recordBytes: 30 }),
  indexEntry("yt", { audioKind: "youtube", storedAudioBytes: 200, recordBytes: 20 }),
  indexEntry("yt-gone", { audioKind: "youtube", storedAudioBytes: 0, recordBytes: 10 }),
  indexEntry("none", { audioKind: "none", storedAudioBytes: 0 }),
];
const STEMS = [
  { jobKey: "h1|fp32|v2", bytes: 70, createdAt: 1 },
  { jobKey: "h2|fp32|v2", bytes: 5, createdAt: 2 },
];

describe("storageUsage", () => {
  it("splits usage into local audio, YouTube audio, stems and lyrics", () => {
    expect(storageUsage(ENTRIES, STEMS)).toEqual({
      localAudioBytes: 400,
      youtubeAudioBytes: 200,
      stemBytes: 75,
      lyricsBytes: 60,
      totalBytes: 735,
    });
  });

  it("counts audio with no index entry as local audio", () => {
    expect(storageUsage(ENTRIES, STEMS, 25).localAudioBytes).toBe(425);
  });

  describe("edge cases", () => {
    it("is all zeros for an empty device", () => {
      expect(storageUsage([], [])).toEqual({
        localAudioBytes: 0,
        youtubeAudioBytes: 0,
        stemBytes: 0,
        lyricsBytes: 0,
        totalBytes: 0,
      });
    });

    it("counts entries saved before record sizes existed as zero lyrics", () => {
      expect(storageUsage([indexEntry("old", { recordBytes: undefined })], []).lyricsBytes).toBe(0);
    });

    it("counts stored bytes on an entry with no audio source as local audio", () => {
      expect(storageUsage([indexEntry("x", { audioKind: "none", storedAudioBytes: 9 })], []).localAudioBytes).toBe(9);
    });
  });

  describe("invariants", () => {
    it("local plus YouTube audio is the stored audio total the library footer shows", () => {
      const usage = storageUsage(ENTRIES, STEMS);
      expect(usage.localAudioBytes + usage.youtubeAudioBytes).toBe(storedAudioBytesTotal(ENTRIES));
    });

    it("the total is the sum of the four categories", () => {
      const usage = storageUsage(ENTRIES, STEMS, 11);
      expect(usage.totalBytes).toBe(
        usage.localAudioBytes + usage.youtubeAudioBytes + usage.stemBytes + usage.lyricsBytes,
      );
    });
  });
});

describe("hasClearableStems", () => {
  it("is true when a stem job that is not in use holds bytes", () => {
    expect(hasClearableStems(STEMS, (jobKey) => jobKey === "h1|fp32|v2")).toBe(true);
  });

  describe("edge cases", () => {
    it("is false when every stem job is in use", () => {
      expect(hasClearableStems(STEMS, () => true)).toBe(false);
    });

    it("is false when the only job not in use is empty", () => {
      expect(hasClearableStems([{ jobKey: "empty", bytes: 0, createdAt: 1 }], () => false)).toBe(false);
    });
  });
});

describe("oldestStemJobFirst", () => {
  it("orders by created-at time", () => {
    expect(
      STEMS.toReversed()
        .toSorted(oldestStemJobFirst)
        .map((job) => job.jobKey),
    ).toEqual(["h1|fp32|v2", "h2|fp32|v2"]);
  });

  describe("invariants", () => {
    it("breaks a created-at tie by job key, whatever the input order", () => {
      const tied = [
        { jobKey: "y", bytes: 1, createdAt: 5 },
        { jobKey: "x", bytes: 1, createdAt: 5 },
      ];
      expect(tied.toSorted(oldestStemJobFirst).map((job) => job.jobKey)).toEqual(["x", "y"]);
    });
  });
});
