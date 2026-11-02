import { Scroll } from "@/ui/scroll";
import { MetadataPanel } from "@/views/export/metadata-panel";
import { UnisonPanel } from "@/views/export/unison/unison-panel";

// -- Components ----------------------------------------------------------------

const ExportSidePanel: React.FC = () => (
  <Scroll className="border-l border-(--divider)">
    <UnisonPanel />
    <MetadataPanel />
  </Scroll>
);

// -- Exports -------------------------------------------------------------------

export { ExportSidePanel };
