import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadText, localDateStamp, sanitizeFileName } from "@/lib/download-file";
import { exportProjectToFile } from "@/lib/persistence";
import { buildRecoveryResult } from "@/lib/recovery";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";

const ORIGINAL_TZ = process.env.TZ;
const FIVE_PAST_MIDNIGHT_IST_SEP_27 = new Date("2026-09-26T18:35:00Z");

function runAtFivePastMidnightIst(): void {
  beforeEach(() => {
    process.env.TZ = "Asia/Kolkata";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIVE_PAST_MIDNIGHT_IST_SEP_27);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });
}

interface CapturedDownload {
  name: string;
  href: string;
  blob: Blob | null;
  revoked: string[];
}

function captureDownload(run: () => void): CapturedDownload {
  const captured: CapturedDownload = { name: "", href: "", blob: null, revoked: [] };
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    if (obj instanceof Blob) captured.blob = obj;
    return "blob:test";
  };
  URL.revokeObjectURL = (url: string) => {
    captured.revoked.push(url);
  };
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.name = this.download;
    captured.href = this.href;
  });
  try {
    run();
  } finally {
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
  return captured;
}

function captureDownloadName(run: () => void): string {
  return captureDownload(run).name;
}

function exportProject(title: string): string {
  return captureDownloadName(() =>
    exportProjectToFile({
      metadata: { title, artists: [], album: "", duration: 0 },
      agents: [],
      lines: [],
      groups: [],
      granularity: "word",
      syllableSplitDefaults: DEFAULT_SYLLABLE_SPLIT_DEFAULTS,
      dismissedSuggestions: [],
      dismissedExplicitSuggestions: [],
      customSnapPoints: [],
      importedMetadataKeys: [],
      ttmlEditState: null,
      audioFileName: undefined,
    }),
  );
}

describe("sanitizeFileName", () => {
  it("keeps an ordinary name", () => {
    expect(sanitizeFileName("My Song", "lyrics")).toBe("My Song");
  });

  it("removes filesystem-reserved characters", () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j', "lyrics")).toBe("abcdefghij");
  });

  it("removes control characters", () => {
    expect(sanitizeFileName("a\u0000b\u001fc\u007fd", "lyrics")).toBe("abcd");
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeFileName("a \t\n  b", "lyrics")).toBe("a b");
  });

  it("trims dots and spaces from both ends", () => {
    expect(sanitizeFileName(" ..name.. ", "lyrics")).toBe("name");
  });

  it("keeps a unicode title", () => {
    expect(sanitizeFileName("夜に駆ける Ødegaard é", "lyrics")).toBe("夜に駆ける Ødegaard é");
  });

  it("caps the length at 120 characters", () => {
    expect(sanitizeFileName("a".repeat(300), "lyrics")).toHaveLength(120);
  });

  it("does not leave a trailing dot or space after the cap", () => {
    expect(sanitizeFileName(`${"a".repeat(119)} b`, "lyrics")).toBe("a".repeat(119));
  });

  describe("edge cases", () => {
    it("falls back when the name is empty", () => {
      expect(sanitizeFileName("", "lyrics")).toBe("lyrics");
    });

    it("falls back when only reserved characters remain", () => {
      expect(sanitizeFileName('<>:"/\\|?*', "project")).toBe("project");
    });

    it("falls back when only dots and spaces remain", () => {
      expect(sanitizeFileName(" . .. ", "project")).toBe("project");
    });
  });
});

describe("localDateStamp", () => {
  runAtFivePastMidnightIst();

  it("uses the local date when UTC is still on the previous day", () => {
    expect(localDateStamp()).toBe("2026-09-27");
  });

  it("formats a given date with zero padding", () => {
    expect(localDateStamp(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});

describe("downloadBlob", () => {
  it("clicks an anchor with the file name and revokes the object URL", () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    const captured = captureDownload(() => downloadBlob(blob, "file.txt"));
    expect(captured.name).toBe("file.txt");
    expect(captured.href).toBe("blob:test");
    expect(captured.blob).toBe(blob);
    expect(captured.revoked).toEqual(["blob:test"]);
  });

  it("leaves no anchor in the document", () => {
    captureDownload(() => downloadBlob(new Blob(["x"]), "file.txt"));
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("downloadText", () => {
  it("downloads the text as a blob of the given type", async () => {
    const captured = captureDownload(() => downloadText("<tt/>", "lyrics.ttml", "application/ttml+xml"));
    expect(captured.name).toBe("lyrics.ttml");
    expect(captured.blob?.type).toBe("application/ttml+xml");
    expect(await captured.blob?.text()).toBe("<tt/>");
  });
});

describe("backup filenames use the local date", () => {
  runAtFivePastMidnightIst();

  it("sanity: local date in this test is 2026-09-27", () => {
    expect(new Date().getDate()).toBe(27);
  });

  it("recovery filename carries the local date", () => {
    expect(buildRecoveryResult({ metadata: { title: "Song" } }).filename).toBe("Song-2026-09-27.ttml-project.json");
  });

  it("project export filename carries the local date", () => {
    expect(exportProject("Song")).toBe("Song-2026-09-27.ttml-project.json");
  });
});

describe("download filenames are sanitized", () => {
  it("strips filesystem-reserved characters from the project export name", () => {
    expect(exportProject('a<b>"c/d')).not.toMatch(/[<>"/\\:|?*]/);
  });

  it("strips filesystem-reserved characters from the recovery name", () => {
    expect(buildRecoveryResult({ metadata: { title: "a/b:c" } }).filename).not.toMatch(/[<>"/\\:|?*]/);
  });
});
