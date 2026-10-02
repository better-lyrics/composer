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
      className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-composer-accent bg-[color-mix(in_srgb,var(--color-composer-accent)_6%,var(--color-composer-bg))] select-none"
    >
      <IconFileUpload className="size-10 text-composer-accent-text" stroke={1.5} />
      <p className="text-base font-medium text-composer-text">{label}</p>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { FileDropOverlay };
