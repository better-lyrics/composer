import { toast } from "sonner";

// -- Toasts -------------------------------------------------------------------

function showConnectedToast(displayName: string): void {
  toast.success(`Connected as ${displayName}`);
}

function showDisconnectedToast(): void {
  toast("Disconnected from Unison");
}

// -- Exports ------------------------------------------------------------------

export { showConnectedToast, showDisconnectedToast };
