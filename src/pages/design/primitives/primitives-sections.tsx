import { BadgesSection } from "@/pages/design/primitives/badges";
import { ButtonsSection } from "@/pages/design/primitives/buttons";
import { ControlsSection } from "@/pages/design/primitives/controls";
import { FieldsSection } from "@/pages/design/primitives/fields";
import { OverlaysSection } from "@/pages/design/primitives/overlays";

// -- Components ----------------------------------------------------------------

const PrimitivesSections: React.FC = () => (
  <>
    <ButtonsSection />
    <ControlsSection />
    <FieldsSection />
    <BadgesSection />
    <OverlaysSection />
  </>
);

// -- Exports -------------------------------------------------------------------

export { PrimitivesSections };
