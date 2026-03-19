import { HelpSectionContent } from "@/ui/help-sections";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import {
  IconCommand,
  IconDownload,
  IconEye,
  IconHandClick,
  IconKeyboard,
  IconMusic,
  IconPencil,
  IconRocket,
  IconLayoutRows,
} from "@tabler/icons-react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

interface ShortcutItemProps {
  keys: string[];
  description: string;
}

interface ShortcutSectionProps {
  title: string;
  shortcuts: ShortcutItemProps[];
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

// -- Helpers ------------------------------------------------------------------

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

function formatKey(key: string): string {
  if (key === "Mod") return isMac ? "⌘" : "Ctrl";
  if (key === "Shift") return "⇧";
  if (key === "Alt") return isMac ? "⌥" : "Alt";
  if (key === "Space") return "Space";
  if (key === "Enter") return "↵";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  return key;
}

// -- Data ---------------------------------------------------------------------

const SHORTCUT_SECTIONS: ShortcutSectionProps[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Shift", "?"], description: "Show keyboard shortcuts" },
      { keys: ["Enter"], description: "Play / Pause audio" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Mod", "1"], description: "Go to Import tab" },
      { keys: ["Mod", "2"], description: "Go to Edit tab" },
      { keys: ["Mod", "3"], description: "Go to Sync tab" },
      { keys: ["Mod", "4"], description: "Go to Timeline tab" },
      { keys: ["Mod", "5"], description: "Go to Preview tab" },
      { keys: ["Mod", "6"], description: "Go to Export tab" },
    ],
  },
  {
    title: "Sync Mode",
    shortcuts: [
      { keys: ["Space"], description: "Start sync / Tap to sync word" },
      { keys: ["ArrowLeft"], description: "Nudge last synced -50ms" },
      { keys: ["ArrowRight"], description: "Nudge last synced +50ms" },
      { keys: ["Mod", "Z"], description: "Undo" },
      { keys: ["Mod", "Shift", "Z"], description: "Redo" },
    ],
  },
  {
    title: "Timeline Mode",
    shortcuts: [
      { keys: ["F"], description: "Toggle follow playhead" },
      { keys: ["P"], description: "Toggle preview sidebar" },
      { keys: ["N"], description: "Insert line below selected word" },
      { keys: ["Space"], description: "Jump viewport to playhead" },
      { keys: ["Escape"], description: "Deselect / cancel paste" },
      { keys: ["["], description: "Set word begin to playhead" },
      { keys: ["]"], description: "Set word end to playhead" },
      { keys: ["Mod", "Z"], description: "Undo" },
      { keys: ["Mod", "Shift", "Z"], description: "Redo" },
      { keys: ["Mod", "Shift", "V"], description: "Import lyrics" },
      { keys: ["Mod", "Scroll"], description: "Zoom in / out" },
      { keys: ["Middle", "Drag"], description: "Pan timeline" },
      { keys: ["Shift", "Middle", "Drag"], description: "Pan locked to axis" },
    ],
  },
  {
    title: "Timeline Selection",
    shortcuts: [
      { keys: ["Click"], description: "Select word" },
      { keys: ["Mod", "A"], description: "Select all words" },
      { keys: ["Mod", "Click"], description: "Toggle word in selection" },
      { keys: ["Drag"], description: "Marquee select words" },
      { keys: ["Shift", "Drag"], description: "Add to selection with marquee" },
      { keys: ["Mod", "C"], description: "Copy selected words" },
      { keys: ["Mod", "X"], description: "Cut selected words" },
      { keys: ["Mod", "V"], description: "Paste (ghost preview, click to place)" },
      { keys: ["Delete"], description: "Delete selected words" },
      { keys: ["Alt", "Drag"], description: "Duplicate selected words" },
      { keys: ["E"], description: "Edit selected word text" },
      { keys: ["F2"], description: "Edit selected word text" },
      { keys: ["S"], description: "Split selected word into syllables" },
      { keys: ["M"], description: "Merge adjacent selected words" },
      { keys: ["Double Click"], description: "Edit word / create word" },
    ],
  },
  {
    title: "Edit Mode",
    shortcuts: [
      { keys: ["Click"], description: "Select / deselect line" },
      { keys: ["Alt", "Click"], description: "Select range of lines" },
    ],
  },
];

const HELP_SECTIONS: HelpSectionDef[] = [
  { id: "getting-started", label: "Getting Started", icon: IconRocket },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", icon: IconKeyboard },
  { id: "importing", label: "Importing Audio", icon: IconMusic },
  { id: "editing", label: "Editing Lyrics", icon: IconPencil },
  { id: "syncing", label: "Syncing", icon: IconHandClick },
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "preview", label: "Preview", icon: IconEye },
  { id: "exporting", label: "Exporting", icon: IconDownload },
];

// -- Shared Components --------------------------------------------------------

const KeyBadge: React.FC<{ keyName: string }> = ({ keyName }) => {
  const formatted = formatKey(keyName);
  const isSymbol = formatted.length === 1 && !/[a-zA-Z0-9]/.test(formatted);

  return (
    <span
      className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-medium rounded bg-composer-button border border-composer-border ${
        isSymbol ? "text-base" : ""
      }`}
    >
      {keyName === "Mod" && isMac ? <IconCommand className="w-3.5 h-3.5" /> : formatted}
    </span>
  );
};

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-composer-text-secondary">{description}</span>
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: key order is fixed
        <KeyBadge key={`${key}-${i}`} keyName={key} />
      ))}
    </div>
  </div>
);

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, shortcuts }) => (
  <div>
    <h3 className="mb-2 text-xs font-medium tracking-wide text-composer-text-muted">{title}</h3>
    <div className="flex flex-col">
      {shortcuts.map((shortcut, i) => (
        <ShortcutItem key={`${shortcut.description}-${i}`} {...shortcut} />
      ))}
    </div>
  </div>
);

// -- Help Modal ---------------------------------------------------------------

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState("getting-started");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help"
      className="max-w-4xl h-[80%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <div className="flex flex-1 min-h-0">
        <nav className="w-48 shrink-0 border-r border-composer-border p-2 space-y-px overflow-y-auto select-none">
          {HELP_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors",
                  isActive
                    ? "bg-composer-button text-composer-text font-medium"
                    : "text-composer-text-secondary hover:bg-composer-button/50 hover:text-composer-text",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          <HelpSectionContent section={activeSection} />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none flex items-center justify-center gap-1.5">
        Press{" "}
        <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[11px] font-medium rounded bg-composer-button border border-composer-border">
          ?
        </kbd>{" "}
        to open anytime
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { HelpModal, KeyBadge, ShortcutItem, ShortcutSection, SHORTCUT_SECTIONS, formatKey };
