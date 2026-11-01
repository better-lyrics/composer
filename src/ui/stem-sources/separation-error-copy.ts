import type { SeparationError } from "@/audio/separation/types";

// -- Types --------------------------------------------------------------------

interface SeparationErrorCopy {
  title: string;
  next: string;
}

// -- Constants ----------------------------------------------------------------

const TRY_AGAIN_OR_IMPORT = "Try again, or import stems you already have.";

// -- Copy ---------------------------------------------------------------------

function separationErrorCopy(code: SeparationError["code"]): SeparationErrorCopy {
  if (code === "fetch-failed") {
    return { title: "Couldn't download the vocal model", next: "Check your connection and try again." };
  }
  if (code === "integrity-mismatch") {
    return { title: "The model download was damaged", next: "Try again to download a fresh copy." };
  }
  if (code === "decode-failed") return { title: "Couldn't read this song", next: TRY_AGAIN_OR_IMPORT };
  return { title: "Separation failed", next: TRY_AGAIN_OR_IMPORT };
}

// -- Exports ------------------------------------------------------------------

export { separationErrorCopy };
