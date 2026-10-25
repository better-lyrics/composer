import { flushPendingSave } from "@/lib/persistence-debounce";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconRefresh } from "@tabler/icons-react";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[PreviewLoadFailed]";

// -- Helpers -------------------------------------------------------------------

function saveAndReload(): void {
  flushPendingSave().then(
    () => window.location.reload(),
    (error: unknown) => console.error(LOG_PREFIX, "save before reload failed; not reloading", error),
  );
}

// -- Components ----------------------------------------------------------------

const PreviewLoadFailed: React.FC = () => (
  <EmptyState
    message="Preview couldn't load"
    hint="A new version of Composer may have shipped while you were working. Reload to get it."
    action={
      <Button variant="secondary" hasIcon onClick={saveAndReload} className="mt-2">
        <IconRefresh className="size-4" />
        Reload
      </Button>
    }
  />
);

// -- Exports -------------------------------------------------------------------

export { PreviewLoadFailed };
