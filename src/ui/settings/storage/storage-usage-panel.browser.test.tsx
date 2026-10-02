import type { StorageUsage } from "@/domain/storage/usage";
import { render } from "@/test/render";
import { StorageUsagePanel } from "@/ui/settings/storage/storage-usage-panel";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const MEBIBYTE = 1024 ** 2;
const USAGE: StorageUsage = {
  localAudioBytes: 41.8 * MEBIBYTE,
  youtubeAudioBytes: 212.4 * MEBIBYTE,
  stemBytes: 58.1 * MEBIBYTE,
  lyricsBytes: 3.2 * MEBIBYTE,
  totalBytes: 315.5 * MEBIBYTE,
};

// -- Tests --------------------------------------------------------------------

describe("StorageUsagePanel", () => {
  it("shows the total, the free space and each category", async () => {
    const screen = await render(<StorageUsagePanel usage={USAGE} freeBytes={48.2 * 1024 ** 3} youtubeKept />);
    await expect.element(screen.getByText("315.5 MB")).toBeInTheDocument();
    await expect.element(screen.getByText("used on this device")).toBeInTheDocument();
    await expect.element(screen.getByText("About 48 GB free")).toBeInTheDocument();
    for (const [label, value] of [
      ["Local audio", "41.8 MB"],
      ["YouTube audio", "212.4 MB"],
      ["Vocal stems", "58.1 MB"],
      ["Lyrics and timings", "3.2 MB"],
    ]) {
      await expect.element(screen.getByRole("term").filter({ hasText: label })).toBeInTheDocument();
      await expect.element(screen.getByRole("definition").filter({ hasText: value })).toBeInTheDocument();
    }
  });

  it("describes the bar for screen readers", async () => {
    const screen = await render(<StorageUsagePanel usage={USAGE} freeBytes={undefined} youtubeKept />);
    await expect
      .element(
        screen.getByRole("img", {
          name: "Storage used: Local audio 41.8 MB, YouTube audio 212.4 MB, Vocal stems 58.1 MB, Lyrics and timings 3.2 MB",
        }),
      )
      .toBeInTheDocument();
  });

  it("says YouTube audio is not stored when the rule does not keep it and none is stored", async () => {
    const usage = { ...USAGE, youtubeAudioBytes: 0, totalBytes: USAGE.totalBytes - USAGE.youtubeAudioBytes };
    const screen = await render(<StorageUsagePanel usage={usage} freeBytes={undefined} youtubeKept={false} />);
    await expect.element(screen.getByRole("definition").filter({ hasText: "Not stored" })).toBeInTheDocument();
    await expect.element(screen.getByRole("img", { name: /YouTube audio Not stored/ })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("still shows YouTube bytes that were stored before the rule changed", async () => {
      const screen = await render(<StorageUsagePanel usage={USAGE} freeBytes={undefined} youtubeKept={false} />);
      await expect.element(screen.getByRole("definition").filter({ hasText: "212.4 MB" })).toBeInTheDocument();
    });

    it("hides the free space when the browser gives no estimate", async () => {
      const screen = await render(<StorageUsagePanel usage={USAGE} freeBytes={undefined} youtubeKept />);
      expect(screen.container.textContent).not.toContain("free");
    });

    it("draws one bar segment per category with bytes", async () => {
      const usage = { ...USAGE, stemBytes: 0 };
      const screen = await render(<StorageUsagePanel usage={usage} freeBytes={undefined} youtubeKept />);
      expect(screen.getByRole("img").element().children).toHaveLength(3);
    });

    it("shows an empty device as 0 B", async () => {
      const empty = { localAudioBytes: 0, youtubeAudioBytes: 0, stemBytes: 0, lyricsBytes: 0, totalBytes: 0 };
      const screen = await render(<StorageUsagePanel usage={empty} freeBytes={undefined} youtubeKept />);
      expect(screen.getByRole("img").element().children).toHaveLength(0);
      await expect.element(screen.getByText("used on this device")).toBeInTheDocument();
    });
  });
});
