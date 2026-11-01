import type { ModalNavSection } from "@/ui/modal-nav-layout";
import {
  IconAward,
  IconDownload,
  IconEye,
  IconFileImport,
  IconHandClick,
  IconInfoHexagon,
  IconKeyboard,
  IconLayoutRows,
  IconLifebuoy,
  IconLink,
  IconPencil,
  IconRocket,
  IconTagStarred,
} from "@tabler/icons-react";

// -- Sections ------------------------------------------------------------------

const HELP_SECTIONS: readonly ModalNavSection[] = [
  { id: "getting-started", label: "Getting Started", icon: IconRocket },
  { id: "best-practices", label: "Best practices", icon: IconTagStarred },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", icon: IconKeyboard },
  { id: "importing", label: "Importing", icon: IconFileImport },
  { id: "editing", label: "Editing Lyrics", icon: IconPencil },
  { id: "syncing", label: "Syncing", icon: IconHandClick },
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "groups", label: "Linked groups", icon: IconLink },
  { id: "preview", label: "Preview", icon: IconEye },
  { id: "exporting", label: "Exporting", icon: IconDownload },
  { id: "recovery", label: "Recovery", icon: IconLifebuoy },
  { id: "ttml-standards", label: "TTML & standards", icon: IconAward },
  { id: "about", label: "About", icon: IconInfoHexagon },
];

// -- Exports -------------------------------------------------------------------

export { HELP_SECTIONS };
