import { formatApproximateFileSize, formatFileSize, formatMegabytes } from "@/utils/format-file-size";
import { describe, expect, it } from "vitest";

describe("formatFileSize", () => {
  it("uses bytes, kilobytes or megabytes with one decimal", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(9_830)).toBe("9.6 KB");
    expect(formatFileSize(43_830_067)).toBe("41.8 MB");
  });

  describe("edge cases", () => {
    it("formats zero and the unit boundaries", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(1023)).toBe("1023 B");
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    });
  });
});

describe("formatFileSize regressions", () => {
  it("regression: a size that rounds up to 1024 KB shows as 1.0 MB", () => {
    expect(formatFileSize(1_048_575)).toBe("1.0 MB");
    expect(formatFileSize(1_048_525)).toBe("1.0 MB");
  });

  it("keeps the largest size that stays under 1024 KB in kilobytes", () => {
    expect(formatFileSize(1_048_524)).toBe("1023.9 KB");
  });
});

describe("formatFileSize gigabytes", () => {
  it("uses gigabytes with two decimals from 1024 MB up", () => {
    expect(formatFileSize(1024 ** 3)).toBe("1.00 GB");
    expect(formatFileSize(2.05 * 1024 ** 3)).toBe("2.05 GB");
  });

  describe("regressions", () => {
    it("regression: a size that rounds up to 1024 MB shows as 1.00 GB, never 1024.0 MB", () => {
      expect(formatFileSize(1024 ** 3 - 1)).toBe("1.00 GB");
    });

    it("keeps the largest size that stays under 1024 MB in megabytes", () => {
      expect(formatFileSize(1023.9 * 1024 ** 2)).toBe("1023.9 MB");
    });
  });
});

describe("formatApproximateFileSize", () => {
  it("rounds to whole gigabytes from 1 GB up", () => {
    expect(formatApproximateFileSize(48.3 * 1024 ** 3)).toBe("48 GB");
    expect(formatApproximateFileSize(1024 ** 3)).toBe("1 GB");
  });

  describe("edge cases", () => {
    it("falls back to the exact size below 1 GB", () => {
      expect(formatApproximateFileSize(500 * 1024 ** 2)).toBe("500.0 MB");
      expect(formatApproximateFileSize(0)).toBe("0 B");
    });

    it("regression: agrees with itself on both sides of the 1 GB boundary", () => {
      expect(formatApproximateFileSize(1024 ** 3 - 1)).toBe("1 GB");
      expect(formatApproximateFileSize(1024 ** 3)).toBe("1 GB");
    });

    it("regression: matches formatFileSize exactly for a NaN size", () => {
      expect(formatApproximateFileSize(Number.NaN)).toBe(formatFileSize(Number.NaN));
    });

    it("regression: matches formatFileSize exactly for negative sizes", () => {
      expect(formatApproximateFileSize(-500)).toBe(formatFileSize(-500));
      expect(formatApproximateFileSize(-2 * 1024 ** 3)).toBe(formatFileSize(-2 * 1024 ** 3));
    });
  });
});

describe("formatMegabytes", () => {
  it("always uses megabytes with one decimal", () => {
    expect(formatMegabytes(87_031_808)).toBe("83.0 MB");
  });

  describe("edge cases", () => {
    it("shows zero and small sizes in megabytes", () => {
      expect(formatMegabytes(0)).toBe("0.0 MB");
      expect(formatMegabytes(512)).toBe("0.0 MB");
    });
  });
});
