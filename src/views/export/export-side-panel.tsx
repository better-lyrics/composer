import { Scroll } from "@/ui/scroll";
import { MetadataPanel } from "@/views/export/metadata-panel";

// -- Components ----------------------------------------------------------------

const ExportSidePanel: React.FC<{ unison?: React.ReactNode }> = ({ unison }) => (
  <Scroll className="border-l border-(--divider)">
    {unison}
    <MetadataPanel />
  </Scroll>
);

// -- Exports -------------------------------------------------------------------

export { ExportSidePanel };
