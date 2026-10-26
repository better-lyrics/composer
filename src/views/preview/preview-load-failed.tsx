import { flushPendingSave } from "@/lib/persistence-debounce";
import { getSaveStatus } from "@/lib/save-status";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[PreviewLoadFailed]";

// -- Helpers -------------------------------------------------------------------

async function reloadIfSaved(): Promise<boolean> {
  await flushPendingSave();
  if (getSaveStatus() !== "saved") return false;
  window.location.reload();
  return true;
}

// -- Components ----------------------------------------------------------------

const PreviewLoadFailed: React.FC = () => {
  const [saveFailed, setSaveFailed] = useState(false);

  const handleReload = () => {
    reloadIfSaved().then(
      (reloaded) => setSaveFailed(!reloaded),
      (error: unknown) => {
        console.error(LOG_PREFIX, "save before reload failed; not reloading", error);
        setSaveFailed(true);
      },
    );
  };

  return (
    <EmptyState
      message="Preview couldn't load"
      hint="A new version of Composer may have shipped while you were working. Reload to get it."
      action={
        <>
          <Button variant="secondary" hasIcon onClick={handleReload} className="mt-2">
            <IconRefresh className="size-4" />
            Reload
          </Button>
          {saveFailed && (
            <p className="text-xs text-composer-text-muted select-text">
              Your latest changes aren't saved yet, so Composer didn't reload.
            </p>
          )}
        </>
      }
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { PreviewLoadFailed };
