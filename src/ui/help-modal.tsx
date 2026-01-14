import { Modal } from "@/ui/modal";
import { IconCommand, IconKeyboard } from "@tabler/icons-react";

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
      { keys: ["Space"], description: "Play / Pause audio" },
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
      { keys: ["Escape"], description: "Deselect word" },
      { keys: ["["], description: "Set word begin to playhead" },
      { keys: ["]"], description: "Set word end to playhead" },
      { keys: ["Mod", "Z"], description: "Undo" },
      { keys: ["Mod", "Shift", "Z"], description: "Redo" },
      { keys: ["Mod", "Scroll"], description: "Zoom in / out" },
      { keys: ["Middle", "Drag"], description: "Pan timeline" },
      { keys: ["Shift", "Middle", "Drag"], description: "Pan locked to axis" },
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

// -- Components ---------------------------------------------------------------

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

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => {
  return (
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
};

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, shortcuts }) => {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-composer-text-muted">{title}</h3>
      <div className="flex flex-col">
        {shortcuts.map((shortcut, i) => (
          <ShortcutItem key={`${shortcut.description}-${i}`} {...shortcut} />
        ))}
      </div>
    </div>
  );
};

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      className="max-w-3xl max-h-[80%] overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-6 text-sm text-composer-text-muted">
        <IconKeyboard className="w-4 h-4" />
        <span>Use these shortcuts to speed up your workflow</span>
      </div>
      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
        {SHORTCUT_SECTIONS.map((section) => (
          <ShortcutSection key={section.title} {...section} />
        ))}
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { HelpModal };
