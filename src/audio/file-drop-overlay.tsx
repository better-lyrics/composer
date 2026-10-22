import { IconFileUpload } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface FileDropOverlayProps {
  visible: boolean;
  label: string;
}

// -- Component ----------------------------------------------------------------

const FileDropOverlay: React.FC<FileDropOverlayProps> = ({ visible, label }) => {
  if (!visible) return null;
  return (
    <div
      data-file-drop-overlay=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-card)-6px)] border-2 border-dashed border-composer-accent bg-[color-mix(in_oklab,var(--color-composer-accent)_8%,var(--well))] select-none"
    >
      <IconFileUpload className="size-12 text-composer-accent-text" stroke={1.5} />
      <p className="text-[17px] font-medium text-composer-text">{label}</p>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { FileDropOverlay };
