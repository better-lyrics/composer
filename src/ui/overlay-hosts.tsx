import { ChoiceModalHost } from "@/ui/choice-modal";
import { useTransportDeckShown } from "@/hooks/use-transport-deck-shown";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { screenForPath } from "@/utils/app-routes";
import { useLocation } from "react-router-dom";
import { Toaster } from "sonner";

// -- Constants -----------------------------------------------------------------

// Clears the transport deck (80px) with the workspace gap below it.
const TOAST_OFFSET_OVER_DECK = { bottom: "96px" };
const TOAST_OFFSET = { bottom: "24px" };

// -- Components ----------------------------------------------------------------

const OverlayHosts: React.FC = () => {
  const { pathname } = useLocation();
  const deckShown = useTransportDeckShown() && screenForPath(pathname) === "editor";
  return (
    <>
      <ConfirmModalHost />
      <ChoiceModalHost />
      <Toaster position="bottom-center" offset={deckShown ? TOAST_OFFSET_OVER_DECK : TOAST_OFFSET} />
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { OverlayHosts };
