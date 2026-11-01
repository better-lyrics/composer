import { useUIStore } from "@/stores/ui";
import { formatFileSize } from "@/utils/format-file-size";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const STORAGE_FULL_TOAST_ID = "storage-full";

// -- Toasts -------------------------------------------------------------------

function showStorageFullToast(freedBytes: number): void {
  const description =
    freedBytes > 0
      ? `Freed ${formatFileSize(freedBytes)} by removing vocal stems and YouTube audio you haven't opened in a while.`
      : "Remove audio you don't need so Composer can keep saving.";
  toast.error("Storage is full", {
    id: STORAGE_FULL_TOAST_ID,
    description,
    action: {
      label: "Manage storage",
      onClick: () => useUIStore.getState().openSettings({ target: { section: "storage" } }),
    },
  });
}

// -- Exports ------------------------------------------------------------------

export { showStorageFullToast };
