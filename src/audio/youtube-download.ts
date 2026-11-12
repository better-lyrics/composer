import { formatApproximateFileSize, formatMegabytesOf } from "@/utils/format-file-size";
import type { BodyProgress } from "@/utils/read-response-body";

// -- Interfaces ---------------------------------------------------------------

interface YouTubeDownloadProgress {
  label: string;
  percent: number | null;
}

interface DownloadProgressReporter {
  report: (progress: BodyProgress) => void;
  end: () => void;
}

// -- Constants ----------------------------------------------------------------

const YOUTUBE_TUNNEL_QUERY_KEY = "youtube-tunnel";

// -- State --------------------------------------------------------------------

let shownProgress: YouTubeDownloadProgress | null = null;
let currentDownload = 0;
const listeners = new Set<() => void>();

function publish(progress: YouTubeDownloadProgress | null): void {
  shownProgress = progress;
  for (const listener of listeners) listener();
}

function progressLabel({ received, total }: BodyProgress): string {
  return total === null ? formatApproximateFileSize(received) : formatMegabytesOf(received, total);
}

// -- Reporting ----------------------------------------------------------------

function beginDownloadProgress(): DownloadProgressReporter {
  currentDownload += 1;
  const download = currentDownload;
  return {
    report: (progress) => {
      if (download !== currentDownload) return;
      const label = progressLabel(progress);
      if (label === shownProgress?.label) return;
      publish({ label, percent: progress.total === null ? null : (progress.received / progress.total) * 100 });
    },
    end: () => {
      if (download === currentDownload) publish(null);
    },
  };
}

function subscribeDownloadProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function downloadProgressSnapshot(): YouTubeDownloadProgress | null {
  return shownProgress;
}

// -- Exports ------------------------------------------------------------------

export type { YouTubeDownloadProgress };
export { YOUTUBE_TUNNEL_QUERY_KEY, beginDownloadProgress, downloadProgressSnapshot, subscribeDownloadProgress };
