import { ChoiceModalHost } from "@/ui/choice-modal";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { Toaster } from "sonner";

// -- Constants -----------------------------------------------------------------

// Clears the transport deck (80px) with the workspace gap below it.
const TOAST_OFFSET = { bottom: "var(--toast-clearance)" };

// -- Components ----------------------------------------------------------------

const OverlayHosts: React.FC = () => (
  <>
    <ConfirmModalHost />
    <ChoiceModalHost />
    <Toaster position="bottom-center" offset={TOAST_OFFSET} />
  </>
);

// -- Exports -------------------------------------------------------------------

export { OverlayHosts };
