import { storageLimitBytes } from "@/domain/storage/storage-limit";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import type { CleanupContext, CleanupResult } from "@/lib/storage-cleanup";
import { type MaintenanceTrigger, createStorageMaintenance } from "@/lib/storage-maintenance";
import { subscribeStorageSignals } from "@/lib/storage-signals";
import { isStemJobInUse } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { showStorageFullToast } from "@/utils/storage-toast";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const CHECK_DELAY_MS = 1000;

// -- Helpers ------------------------------------------------------------------

function readCleanupContext(): Omit<CleanupContext, "storageFull"> {
  const settings = useSettingsStore.getState();
  return {
    smartCleanup: settings.smartCleanup,
    limitBytes: storageLimitBytes(settings.storageLimit),
    isStemJobInUse,
  };
}

function reportCleanup(result: CleanupResult, trigger: MaintenanceTrigger): void {
  if (trigger === "storage-full") showStorageFullToast(result.freedBytes);
}

// -- Hook ---------------------------------------------------------------------

function useStorageMaintenance(): void {
  useEffect(() => {
    const maintenance = createStorageMaintenance({
      readContext: readCleanupContext,
      onCleaned: reportCleanup,
      delayMs: CHECK_DELAY_MS,
    });
    let active = true;
    let storageFullCheck: Promise<CleanupResult> | null = null;
    void getPersistenceSettled().then(() => {
      if (active) maintenance.schedule();
    });
    const stopSignals = subscribeStorageSignals((signal) => {
      if (signal === "media-stored") maintenance.schedule();
      else if (signal === "storage-full" && !storageFullCheck) {
        storageFullCheck = maintenance.checkNow("storage-full").finally(() => {
          storageFullCheck = null;
        });
      }
    });
    const stopSettings = useSettingsStore.subscribe((state, previous) => {
      if (state.smartCleanup !== previous.smartCleanup || state.storageLimit !== previous.storageLimit) {
        maintenance.schedule();
      }
    });
    return () => {
      active = false;
      stopSignals();
      stopSettings();
      maintenance.dispose();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useStorageMaintenance };
