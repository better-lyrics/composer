import { useCallback, useId, useMemo, useState } from "react";

// -- Hook ---------------------------------------------------------------------

function useFieldError() {
  const fieldId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback(
    (message: string) => {
      setError(message);
      document.getElementById(fieldId)?.focus();
    },
    [fieldId],
  );
  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      error,
      showError,
      clearError,
      fieldProps: {
        id: fieldId,
        "aria-invalid": error !== null,
        "aria-describedby": error === null ? undefined : errorId,
      },
      errorProps: { id: errorId, message: error },
    }),
    [clearError, error, errorId, fieldId, showError],
  );
}

type FieldErrorState = ReturnType<typeof useFieldError>;

// -- Exports ------------------------------------------------------------------

export { useFieldError };
export type { FieldErrorState };
