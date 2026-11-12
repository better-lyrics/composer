import { nextFrame } from "@/lib/frame-loop";
import { useCallback, useId, useMemo, useState } from "react";

// -- Hook ---------------------------------------------------------------------

function useFieldError(formatError: string | null = null) {
  const fieldId = useId();
  const errorId = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formatErrorShown, setFormatErrorShown] = useState(false);

  // Once the value is valid, a format error waits for the next blur again.
  if (formatErrorShown && formatError === null) setFormatErrorShown(false);
  const error = submitError ?? (formatErrorShown ? formatError : null);

  const focusField = useCallback(() => {
    document.getElementById(fieldId)?.focus();
    // Focus scrolls only the field into view; the message renders below it on the next frame.
    nextFrame(() => document.getElementById(errorId)?.scrollIntoView({ block: "nearest" }));
  }, [fieldId, errorId]);
  const showError = useCallback(
    (message: string) => {
      setSubmitError(message);
      focusField();
    },
    [focusField],
  );
  const showFormatError = useCallback(() => {
    setFormatErrorShown(true);
    focusField();
  }, [focusField]);
  const clearError = useCallback(() => setSubmitError(null), []);
  const revealFormatError = useCallback(() => setFormatErrorShown(true), []);

  return useMemo(
    () => ({
      error,
      showError,
      showFormatError,
      clearError,
      fieldProps: {
        id: fieldId,
        "aria-invalid": error !== null,
        "aria-describedby": error === null ? undefined : errorId,
        onBlur: revealFormatError,
      },
      errorProps: { id: errorId, message: error },
    }),
    [clearError, error, errorId, fieldId, revealFormatError, showError, showFormatError],
  );
}

type FieldErrorState = ReturnType<typeof useFieldError>;

// -- Exports ------------------------------------------------------------------

export { useFieldError };
export type { FieldErrorState };
