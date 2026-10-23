import { EscapeLayersDemo } from "@/pages/design/states/escape-layers-demo";
import { NoticesDemo } from "@/pages/design/states/notices-demo";
import { SaveStatusDemo } from "@/pages/design/states/save-status-demo";
import { SelectionPlaybackDemo } from "@/pages/design/states/selection-playback-demo";
import { ToastStackDemo } from "@/pages/design/states/toast-stack-demo";

// -- Components ----------------------------------------------------------------

const StateMachineSections: React.FC = () => (
  <>
    <NoticesDemo />
    <SaveStatusDemo />
    <SelectionPlaybackDemo />
    <ToastStackDemo />
    <EscapeLayersDemo />
  </>
);

// -- Exports -------------------------------------------------------------------

export { StateMachineSections };
