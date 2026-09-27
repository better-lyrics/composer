import { downloadRecoveryFile } from "@/lib/recovery";
import { Button } from "@/ui/button";
import { ClearRecoveryButton } from "@/ui/clear-recovery-button";
import { Scroll } from "@/ui/scroll";
import { describeError, type ErrorPresentation, safeStringify } from "@/pages/error-presentation";
import { PageHead } from "@/seo/page-head";
import { IconChevronDown, IconChevronRight, IconDownload, IconHome2, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useRouteError } from "react-router-dom";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Helpers -------------------------------------------------------------------

function handleReload(): void {
  window.location.reload();
}

function handleGoHome(): void {
  window.location.href = "/";
}

// -- Component -----------------------------------------------------------------

const GoHomeButton: React.FC<{ primary: boolean }> = ({ primary }) => (
  <Button variant={primary ? "primary" : "secondary"} hasIcon onClick={handleGoHome}>
    <IconHome2 size={16} />
    Go home
  </Button>
);

type RecoveryStatus = "idle" | "downloading" | "success" | "empty" | "failed";

const RECOVERY_MESSAGES: Partial<Record<RecoveryStatus, string>> = {
  success: "Saved. Open Composer, head to the Export tab, and click Import Project to keep going.",
  empty: "Nothing saved in this browser yet.",
  failed: "Couldn't reach your save. Try opening /recover in a fresh tab.",
};

const ErrorActions: React.FC<{ homeIsPrimary: boolean }> = ({ homeIsPrimary }) => {
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");

  const handleRecover = async () => {
    setRecoveryStatus("downloading");
    try {
      const result = await downloadRecoveryFile();
      setRecoveryStatus(result.found ? "success" : "empty");
    } catch (err) {
      console.error(LOG_PREFIX, "recovery failed", err);
      setRecoveryStatus("failed");
    }
  };

  const recoveryMessage = RECOVERY_MESSAGES[recoveryStatus];

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {homeIsPrimary && <GoHomeButton primary />}
        <Button variant={homeIsPrimary ? "secondary" : "primary"} hasIcon onClick={handleReload}>
          <IconRefresh size={16} />
          Reload
        </Button>
        {!homeIsPrimary && <GoHomeButton primary={false} />}
        <Button variant="secondary" hasIcon onClick={handleRecover} disabled={recoveryStatus === "downloading"}>
          <IconDownload size={16} />
          {recoveryStatus === "downloading" ? "Downloading…" : "Download my work"}
        </Button>
      </div>
      {recoveryMessage && <p className="text-xs text-composer-text-muted select-text">{recoveryMessage}</p>}
      {recoveryStatus === "success" && (
        <ClearRecoveryButton clearedMessage="Cleared. Reload Composer to start fresh." />
      )}
    </>
  );
};

const TechnicalDetails: React.FC<{ stack?: string; responseData?: unknown }> = ({ stack, responseData }) => {
  const [showDetails, setShowDetails] = useState(false);
  const responseDataString = responseData !== undefined && responseData !== null ? safeStringify(responseData) : null;
  if (!stack && !responseDataString) return null;

  return (
    <div className="w-full mt-2 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-composer-text-muted hover:text-composer-text transition-colors cursor-pointer"
        aria-expanded={showDetails}
      >
        {showDetails ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        Technical details
      </button>
      {showDetails && (
        <div className="w-full flex flex-col gap-2 text-left">
          {responseDataString && (
            <Scroll className="rounded-md bg-composer-button max-h-48">
              <pre className="p-3 text-[11px] leading-relaxed text-composer-text-secondary select-text font-mono">
                {responseDataString}
              </pre>
            </Scroll>
          )}
          {stack && (
            <Scroll className="rounded-md bg-composer-button max-h-72">
              <pre className="p-3 text-[11px] leading-relaxed text-composer-text-secondary select-text font-mono whitespace-pre-wrap">
                {stack}
              </pre>
            </Scroll>
          )}
        </div>
      )}
    </div>
  );
};

const ErrorFallbackPanel: React.FC<{ details: ErrorPresentation }> = ({ details }) => {
  const Icon = details.icon;

  return (
    <div className="min-h-screen bg-composer-bg text-composer-text flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-lg flex flex-col items-center text-center gap-5">
        <Icon size={56} strokeWidth={1.5} className="text-composer-text opacity-50" />

        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-composer-text">{details.title}</h1>
          {details.errorName && details.errorName !== "Error" && (
            <p className="text-xs font-mono text-composer-text-muted select-text">{details.errorName}</p>
          )}
          <p className="text-sm text-composer-text-secondary leading-relaxed select-text break-words">
            {details.subtitle}
          </p>
        </div>

        <ErrorActions homeIsPrimary={details.primaryAction === "home"} />
        <TechnicalDetails stack={details.stack} responseData={details.responseData} />
      </div>
    </div>
  );
};

const ErrorFallback: React.FC = () => {
  const error = useRouteError();
  const details = describeError(error);
  const { pathname } = useLocation();

  console.error(LOG_PREFIX, "route error", error);

  return (
    <>
      <PageHead title={`${details.title} ・ Composer`} description={details.subtitle} path={pathname} noindex />
      <ErrorFallbackPanel details={details} />
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { ErrorFallback, ErrorFallbackPanel };
