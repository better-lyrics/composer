import { DesignSection } from "@/pages/design/design-section";
import { ColorTokens } from "@/pages/design/foundations/color-tokens";
import { Shape } from "@/pages/design/foundations/shape";
import { Surfaces } from "@/pages/design/foundations/surfaces";
import { TypeScale } from "@/pages/design/foundations/type-scale";

// -- Components ----------------------------------------------------------------

const FoundationsSections: React.FC = () => (
  <>
    <DesignSection
      id="color"
      note="Every color comes from the active theme. Pick another theme and these values change."
    >
      <ColorTokens />
    </DesignSection>
    <DesignSection id="surfaces" note="Composer gets its depth from five surfaces, and each has one use.">
      <Surfaces />
    </DesignSection>
    <DesignSection id="shape" note="A short list of shadows and corner sizes, and where each one is used.">
      <Shape />
    </DesignSection>
    <DesignSection id="type" note="Satoshi for words, Geist Mono for times and numbers.">
      <TypeScale />
    </DesignSection>
  </>
);

// -- Exports -------------------------------------------------------------------

export { FoundationsSections };
