import { downloadRecoveryFile, readRecoveryMetadata, type RecoveryResult } from "@/lib/recovery";
import { PageHead } from "@/seo/page-head";
import { Button } from "@/ui/button";
import { ClientOnly } from "@/ui/client-only";
import { IconCheck, IconDownload, IconHome2, IconLifebuoy, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";

// -- Constants -----------------------------------------------------------------

const TITLE = "Recover Project ・ Composer";
const DESCRIPTION = "Download your last autosaved Composer project from this browser.";

// -- Helpers -------------------------------------------------------------------

function formatSavedAt(savedAt: number | undefined): string {
  if (!savedAt) return "unknown";
  try {
    return new Date(savedAt).toLocaleString();
  } catch {
    return new Date(savedAt).toISOString();
  }
}

// -- Component -----------------------------------------------------------------

type RecoveryState =
  | { phase: "reading" }
  | { phase: "ready"; result: RecoveryResult }
  | { phase: "downloaded"; result: RecoveryResult }
  | { phase: "empty" }
  | { phase: "failed"; message: string };

const RecoverPanel: React.FC = () => {
  const [state, setState] = useState<RecoveryState>({ phase: "reading" });

  useEffect(() => {
    let cancelled = false;
    downloadRecoveryFile().then(
      (result) => {
        if (cancelled) return;
        if (!result.found) {
          setState({ phase: "empty" });
        } else {
          setState({ phase: "downloaded", result });
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ phase: "failed", message });
        readRecoveryMetadata().then(
          (meta) => {
            if (cancelled || !meta.found) return;
            setState({ phase: "ready", result: meta });
          },
          () => {},
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownloadAgain = async () => {
    try {
      const result = await downloadRecoveryFile();
      if (!result.found) {
        setState({ phase: "empty" });
      } else {
        setState({ phase: "downloaded", result });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: "failed", message });
    }
  };

  return (
    <div className="min-h-screen bg-composer-bg text-composer-text flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-lg flex flex-col items-center text-center gap-5">
        <IconLifebuoy size={56} strokeWidth={1.5} className="text-composer-text opacity-50" />

        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-composer-text">Recover Project</h1>
          <p className="text-sm text-composer-text-secondary leading-relaxed">
            Reads your last autosaved project from this browser's IndexedDB and downloads it as a file. Import that file
            back into Composer on the home page to continue where you left off.
          </p>
        </div>

        {state.phase === "reading" && <p className="text-xs text-composer-text-muted">Reading IndexedDB…</p>}

        {state.phase === "downloaded" && (
          <div className="flex flex-col items-center gap-2 text-sm">
            <p className="inline-flex items-center gap-2 text-composer-text">
              <IconCheck size={16} className="text-green-400" />
              Downloaded <span className="font-mono text-xs select-text">{state.result.filename}</span>
            </p>
            <p className="text-xs text-composer-text-muted select-text">
              {state.result.lineCount} lines, last saved {formatSavedAt(state.result.savedAt)}
            </p>
          </div>
        )}

        {state.phase === "ready" && (
          <div className="flex flex-col items-center gap-2 text-sm">
            <p className="text-composer-text">Found a saved project on this browser.</p>
            <p className="text-xs text-composer-text-muted select-text">
              {state.result.lineCount} lines, last saved {formatSavedAt(state.result.savedAt)}
            </p>
          </div>
        )}

        {state.phase === "empty" && (
          <p className="text-sm text-composer-text-secondary">
            No saved project found in this browser. If you have one in a different browser or profile, open Composer
            there instead.
          </p>
        )}

        {state.phase === "failed" && (
          <div className="flex flex-col items-center gap-2 text-sm">
            <p className="text-composer-error-text">Couldn't read IndexedDB.</p>
            <p className="text-xs font-mono text-composer-text-muted select-text break-all max-w-md">{state.message}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button variant="primary" hasIcon onClick={handleDownloadAgain} disabled={state.phase === "reading"}>
            <IconDownload size={16} />
            {state.phase === "downloaded" ? "Download again" : "Download"}
          </Button>
          <Button variant="secondary" hasIcon onClick={() => window.location.assign("/")}>
            <IconHome2 size={16} />
            Back to Composer
          </Button>
          {state.phase === "failed" && (
            <Button variant="ghost" hasIcon onClick={() => window.location.reload()}>
              <IconRefresh size={16} />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// -- Page ----------------------------------------------------------------------

const RecoverFallback: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-composer-bg text-composer-text-muted text-sm">
    Reading IndexedDB…
  </div>
);

const RecoverPage: React.FC = () => {
  return (
    <>
      <PageHead title={TITLE} description={DESCRIPTION} path="/recover" />
      <ClientOnly fallback={<RecoverFallback />}>
        <RecoverPanel />
      </ClientOnly>
    </>
  );
};

export default RecoverPage;
export { RecoverPanel };
