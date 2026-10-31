import { useAlignmentStore } from "@/stores/alignment";
import type { DraftResult } from "@/stores/alignment-draft";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { alignmentErrorCopy } from "@/ui/alignment-error-copy";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { showGroupActionToast } from "@/utils/group-toast";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

interface AutoAlignOptions {
  allowDownload?: boolean;
  realign?: boolean;
  /** Show failures as toasts. Off when the caller shows the store's error itself. */
  toastErrors?: boolean;
}

type AutoAlign = (lineIds?: readonly string[], options?: AutoAlignOptions) => Promise<void>;

// -- Constants -----------------------------------------------------------------

const UNKNOWN_WORDS_SHOWN = 8;

// -- State ---------------------------------------------------------------------

// The latest run, from any trigger, so Try again repeats it: the Timeline's one
// line, the Sync tab's whole song with the same realign choice, or a draft.
let lastRequest: { lineIds?: readonly string[]; realign: boolean; draft?: true } = { realign: false };

// -- Functions -----------------------------------------------------------------

function alignedMessage(aligned: number, skipped: number): string {
  const base = `Auto-aligned ${pluralize(aligned, "line")}`;
  return skipped > 0 ? `${base} (${skipped} edited meanwhile, left as is)` : base;
}

function listWords(words: string[]): string {
  const shown = words.slice(0, UNKNOWN_WORDS_SHOWN).join(", ");
  const more = words.length - UNKNOWN_WORDS_SHOWN;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

function showAlignmentError(downloadAndRetry: () => void): void {
  const error = useAlignmentStore.getState().error;
  if (!error) return;
  if (error.code === "needs-vocals") {
    const separation = useSeparationStore.getState();
    toast.error(error.message, {
      action: separation.hostingConfigured
        ? { label: "Separate vocals", onClick: () => void useSeparationStore.getState().separate() }
        : undefined,
    });
    return;
  }
  if (error.code === "needs-model") {
    const size = useAlignmentStore.getState().modelSizeBytes;
    toast(error.message, {
      description: "It's cached in this browser afterwards.",
      // A download this size is a decision; don't let the prompt time out under the user.
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: size ? `Download (${formatWholeMegabytes(size)})` : "Download",
        onClick: downloadAndRetry,
      },
    });
    return;
  }
  toast.error(alignmentErrorCopy(error.code).title, { description: error.message });
}

function showDraftResult(result: DraftResult): void {
  if (result.placed > 0) {
    const firstFlagged = result.firstFlagged;
    toast.success(`Drafted ${pluralize(result.placed, "line")}`, {
      description:
        result.flagged > 0
          ? `${pluralize(result.flagged, "line")} marked in the Timeline may be off. Check ${pluralWord(result.flagged, "it", "them")} first.`
          : "Play it through and fix any line that's off.",
      action:
        firstFlagged !== null
          ? { label: "Check first", onClick: () => useAudioStore.getState().seekTo(firstFlagged) }
          : undefined,
    });
  }
  if (result.unplaced > 0) {
    toast.warning(`${pluralize(result.unplaced, "line")} couldn't be placed`, {
      description: "Tap them by hand, then draft again to place the lines around them.",
    });
  }
  if (result.lowConfidence) {
    toast.warning("Tapping recommended for this song", {
      description:
        "The draft scored low across the song, so lines may be seconds off. Tap the first line after each break and draft again, or tap the song by hand.",
      duration: Number.POSITIVE_INFINITY,
    });
  }
}

// -- Hook ---------------------------------------------------------------------

function useAutoAlign() {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);

  const autoAlign: AutoAlign = useCallback(async (lineIds, options) => {
    lastRequest = { lineIds, realign: options?.realign ?? false };
    const result = await useAlignmentStore.getState().alignLines(lineIds, options);
    if (!result) {
      if (options?.toastErrors !== false) {
        showAlignmentError(() => void autoAlign(lineIds, { allowDownload: true, realign: options?.realign }));
      }
      return;
    }
    if (result.aligned > 0) showGroupActionToast(alignedMessage(result.aligned, result.skipped));
    if (result.fellBack > 0) {
      toast.warning(
        `${pluralize(result.fellBack, "line")} couldn't be aligned and ${pluralWord(result.fellBack, "was", "were")} split evenly`,
        {
          description:
            result.unknownWords.length > 0
              ? `Unknown words: ${listWords(result.unknownWords)}. Fix the spelling or spell numbers out, then align those lines again.`
              : undefined,
        },
      );
    }
    if (result.guessedWords.length > 0) {
      toast.info(`Guessed how to sing ${listWords(result.guessedWords)}`, {
        description: "They're not in the dictionary, so their timing may be off. Check them in the Timeline.",
      });
    }
  }, []);

  const draft = useCallback(async (options: { allowDownload?: boolean; toastErrors?: boolean } = {}) => {
    lastRequest = { realign: false, draft: true };
    const result = await useAlignmentStore.getState().draftLines(options);
    if (result) showDraftResult(result);
    else if (options.toastErrors !== false) showAlignmentError(() => void draft({ allowDownload: true }));
  }, []);

  const cancel = useCallback(() => useAlignmentStore.getState().cancel(), []);
  const retry = useCallback(() => {
    if (lastRequest.draft) return void draft({ allowDownload: true, toastErrors: false });
    void autoAlign(lastRequest.lineIds, { allowDownload: true, realign: lastRequest.realign, toastErrors: false });
  }, [autoAlign, draft]);

  return {
    autoAlign,
    draft,
    cancel,
    retry,
    isDownloading: status === "downloading",
    isRunning: status === "running" || status === "downloading",
    progress,
  };
}

// -- Exports ------------------------------------------------------------------

export { useAutoAlign };
