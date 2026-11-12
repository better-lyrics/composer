import { type ExternalToast, toast as sonnerToast, useSonner } from "sonner";

// -- Interfaces ----------------------------------------------------------------

type ToastMessage = Parameters<typeof sonnerToast>[0];

// -- Constants -----------------------------------------------------------------

const ACTION_TOAST_DURATION_MS = 20_000;

// -- Lifetimes -----------------------------------------------------------------

function withActionLifetime(options?: ExternalToast): ExternalToast | undefined {
  if (!options?.action || options.duration !== undefined) return options;
  return { ...options, duration: ACTION_TOAST_DURATION_MS };
}

function withErrorLifetime(options?: ExternalToast): ExternalToast {
  return { duration: Number.POSITIVE_INFINITY, closeButton: true, ...options };
}

const toast = Object.assign(
  (message: ToastMessage, options?: ExternalToast) => sonnerToast(message, withActionLifetime(options)),
  sonnerToast,
  {
    success: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.success(message, withActionLifetime(options)),
    info: (message: ToastMessage, options?: ExternalToast) => sonnerToast.info(message, withActionLifetime(options)),
    warning: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.warning(message, withActionLifetime(options)),
    error: (message: ToastMessage, options?: ExternalToast) => sonnerToast.error(message, withErrorLifetime(options)),
  },
);

// -- Exports -------------------------------------------------------------------

export { toast, useSonner };
