import { HelpSectionContent } from "@/ui/help-sections";
import { Modal } from "@/ui/modal";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { ModalNavLayout } from "@/ui/modal-nav-layout";
import { SettingLinkContext, type SettingLinkHost } from "@/ui/setting-link-context";
import { KeyBadge } from "@/ui/shortcut-reference";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface HelpModalProps {
  isOpen: boolean;
  initialSection?: string;
  initialScrollTop?: number;
  onClose: () => void;
}

// -- Help Modal ---------------------------------------------------------------

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, initialSection, initialScrollTop = 0, onClose }) => {
  const [activeSection, setActiveSection] = useState(initialSection ?? "getting-started");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const linkHost = useMemo<SettingLinkHost>(
    () => ({ returnPoint: () => ({ section: activeSection, scrollTop: viewportRef.current?.scrollTop ?? 0 }) }),
    [activeSection],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help"
      className="max-w-4xl h-[80%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <ModalNavLayout
        sections={HELP_SECTIONS}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        sidebarClassName="w-48"
        contentClassName="p-6"
        contentInitialScrollTop={initialScrollTop}
        contentViewportRef={viewportRef}
      >
        <SettingLinkContext value={linkHost}>
          <div data-help-content>
            <HelpSectionContent section={activeSection} />
          </div>
        </SettingLinkContext>
      </ModalNavLayout>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none flex items-center justify-center gap-1.5">
        Press{" "}
        {getEffectiveKeysArray("global.help").map((key) => (
          <KeyBadge key={key} keyName={key} />
        ))}{" "}
        to open anytime
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { HelpModal };
