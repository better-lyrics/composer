import type { AlignmentErrorCode } from "@/stores/alignment";

// -- Types --------------------------------------------------------------------

interface AlignmentErrorCopy {
  title: string;
  next: string;
}

// -- Copy ---------------------------------------------------------------------

function alignmentErrorCopy(code: AlignmentErrorCode): AlignmentErrorCopy {
  if (code === "unavailable") {
    return { title: "Auto-align isn't available here", next: "Time the words by hand in Word mode." };
  }
  if (code === "unsupported-language") {
    return {
      title: "The model doesn't cover this song's language",
      next: "Pick a model that covers it, check the song language, or time the words by hand.",
    };
  }
  if (code === "needs-vocals") {
    return {
      title: "Separate the vocals first",
      next: "Auto-align listens to the vocals alone. Separate them, then try again.",
    };
  }
  if (code === "needs-model") {
    return {
      title: "The alignment model isn't downloaded",
      next: "Try again to download it. Later runs use the saved copy.",
    };
  }
  return { title: "Auto-align failed", next: "Check the line timing, then try again." };
}

// -- Exports ------------------------------------------------------------------

export { alignmentErrorCopy };
