// -- Interfaces ---------------------------------------------------------------

interface DropTileContentProps {
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
}

// -- Component ----------------------------------------------------------------

const DropTileContent: React.FC<DropTileContentProps> = ({ icon, title, detail }) => (
  <>
    <span className="grid place-items-center size-10 shrink-0 rounded-[10px] btn-raised text-(--label)">{icon}</span>
    <span className="flex min-w-0 flex-col text-left">
      <strong className="text-sm font-medium">{title}</strong>
      <small className="mt-0.5 text-xs text-(--muted)">{detail}</small>
    </span>
  </>
);

// -- Exports ------------------------------------------------------------------

export { DropTileContent };
