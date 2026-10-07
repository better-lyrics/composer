import { alignmentModelSizeMb, useAlignmentStore } from "@/stores/alignment";
import { useSeparationStore } from "@/stores/separation";
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

function showAlignmentError(autoAlign: AutoAlign, lineIds?: readonly string[], realign?: boolean): void {
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
    const size = alignmentModelSizeMb();
    toast(error.message, {
      description: "It's cached in this browser afterwards.",
      // A download this size is a decision; don't let the prompt time out under the user.
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: size ? `Download (${size} MB)` : "Download",
        onClick: () => void autoAlign(lineIds, { allowDownload: true, realign }),
      },
    });
    return;
  }
  toast.error(error.code === "failed" ? `Auto-align failed: ${error.message}` : error.message);
}

// -- Hook ---------------------------------------------------------------------

function useAutoAlign() {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);

  const autoAlign: AutoAlign = useCallback(async (lineIds, options) => {
    const result = await useAlignmentStore.getState().alignLines(lineIds, options);
    if (!result) {
      if (options?.toastErrors !== false) showAlignmentError(autoAlign, lineIds, options?.realign);
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
  }, []);

  const cancel = useCallback(() => useAlignmentStore.getState().cancel(), []);

  return {
    autoAlign,
    cancel,
    isDownloading: status === "downloading",
    isRunning: status === "running" || status === "downloading",
    progress,
  };
}

// -- Exports ------------------------------------------------------------------

export { useAutoAlign };
