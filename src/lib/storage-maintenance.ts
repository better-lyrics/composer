import { type CleanupContext, type CleanupResult, NOTHING_CLEANED, runSmartCleanup } from "@/lib/storage-cleanup";

// -- Types --------------------------------------------------------------------

type MaintenanceTrigger = "scheduled" | "storage-full";

interface StorageMaintenanceOptions {
  readContext: () => Omit<CleanupContext, "storageFull">;
  onCleaned: (result: CleanupResult, trigger: MaintenanceTrigger) => void;
  delayMs: number;
}

interface StorageMaintenance {
  schedule: () => void;
  checkNow: (trigger: MaintenanceTrigger) => Promise<CleanupResult>;
  dispose: () => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StorageMaintenance]";

// -- Scheduler ----------------------------------------------------------------

function createStorageMaintenance(options: StorageMaintenanceOptions): StorageMaintenance {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  const runCheck = async (trigger: MaintenanceTrigger): Promise<CleanupResult> => {
    if (disposed) return NOTHING_CLEANED;
    try {
      const result = await runSmartCleanup({ ...options.readContext(), storageFull: trigger === "storage-full" });
      if (!disposed) options.onCleaned(result, trigger);
      return result;
    } catch (error) {
      console.error(LOG_PREFIX, "smart cleanup failed", error);
      try {
        if (!disposed) options.onCleaned(NOTHING_CLEANED, trigger);
      } catch (onCleanedError) {
        console.error(LOG_PREFIX, "onCleaned failed", onCleanedError);
      }
      return NOTHING_CLEANED;
    }
  };

  const checkNow = (trigger: MaintenanceTrigger): Promise<CleanupResult> => {
    const next = queue.then(() => runCheck(trigger));
    queue = next;
    return next;
  };

  const schedule = (): void => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void checkNow("scheduled");
    }, options.delayMs);
  };

  const dispose = (): void => {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { schedule, checkNow, dispose };
}

// -- Exports ------------------------------------------------------------------

export { createStorageMaintenance };
export type { MaintenanceTrigger };
