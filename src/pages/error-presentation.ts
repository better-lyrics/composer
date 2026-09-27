import { type Icon, IconBug, IconDiscOff, IconGhost2 } from "@tabler/icons-react";
import { isRouteErrorResponse } from "react-router-dom";

// -- Types ---------------------------------------------------------------------

interface ErrorPresentation {
  title: string;
  subtitle: string;
  icon: Icon;
  primaryAction: "home" | "reload";
  status?: number;
  errorName?: string;
  statusText?: string;
  stack?: string;
  responseData?: unknown;
}

// -- Constants -----------------------------------------------------------------

const NOT_FOUND: ErrorPresentation = {
  title: "Page not found",
  subtitle: "We couldn't find that page.",
  icon: IconDiscOff,
  primaryAction: "home",
  status: 404,
};

// -- Helpers -------------------------------------------------------------------

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function describeError(error: unknown): ErrorPresentation {
  if (error === undefined || error === null) return NOT_FOUND;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return { ...NOT_FOUND, statusText: error.statusText, responseData: error.data };
    return {
      title: `${error.status}`,
      subtitle: error.statusText || "The route returned an error response.",
      icon: IconGhost2,
      primaryAction: "reload",
      status: error.status,
      statusText: error.statusText,
      responseData: error.data,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Something broke",
      subtitle: error.message || "The view threw without a message.",
      icon: IconBug,
      primaryAction: "reload",
      errorName: error.name,
      stack: error.stack,
    };
  }

  return {
    title: "Something broke",
    subtitle: typeof error === "string" ? error : "The view threw a non-Error value.",
    icon: IconBug,
    primaryAction: "reload",
    stack: safeStringify(error),
  };
}

// -- Exports -------------------------------------------------------------------

export { describeError, safeStringify };
export type { ErrorPresentation };
