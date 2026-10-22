import { cn } from "@/utils/cn";

// -- Interfaces ---------------------------------------------------------------

interface SourceCardProps {
  art: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "warning";
}

// -- Constants ----------------------------------------------------------------

const IMPORT_AREA = "flex flex-1 size-full p-2";

// -- Components ---------------------------------------------------------------

const OrDivider: React.FC = () => (
  <div className="flex items-center gap-3 w-full select-none">
    <div className="flex-1 h-px bg-(--divider)" />
    <span className="text-xs text-(--muted)">or</span>
    <div className="flex-1 h-px bg-(--divider)" />
  </div>
);

// The whole tab is the drop zone: a dashed well concentric with the workspace card, content centred in one column.
const ImportZone: React.FC<{ tone?: "warning"; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className={cn(
      "flex flex-1 min-h-0 overflow-y-auto overscroll-none rounded-[calc(var(--radius-card)-6px)] border-[1.5px] border-dashed transition-colors",
      tone === "warning"
        ? "border-composer-warning/40 bg-[color-mix(in_oklab,var(--color-composer-warning)_3%,var(--well))]"
        : "border-composer-text/13 hover:border-composer-text/22 bg-(--well)",
    )}
  >
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-[560px] m-auto p-8">{children}</div>
  </div>
);

const SourceCard: React.FC<SourceCardProps> = ({ art, title, subtitle, trailing, tone }) => (
  <div
    className={cn(
      "flex items-center gap-3.5 w-full p-2.5 pr-3.5 rounded-2xl border",
      tone === "warning" ? "bg-composer-warning/6 border-composer-warning/28" : "bg-composer-bg border-(--edge)",
    )}
  >
    <div
      className={cn(
        "grid place-items-center size-16 shrink-0 overflow-hidden rounded-[10px]",
        tone === "warning"
          ? "bg-[color-mix(in_oklab,var(--color-composer-warning)_14%,var(--color-composer-bg))] text-composer-warning"
          : "bg-[color-mix(in_oklab,var(--color-composer-accent)_14%,var(--color-composer-bg))] text-composer-accent-text",
      )}
    >
      {art}
    </div>
    <div className="flex flex-1 min-w-0 flex-col gap-[3px]">
      <div className="text-[15px] font-semibold truncate text-composer-text select-text">{title}</div>
      <div className={cn("text-[12.5px] select-text", tone === "warning" ? "text-composer-warning" : "text-(--muted)")}>
        {subtitle}
      </div>
    </div>
    {trailing}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { IMPORT_AREA, ImportZone, OrDivider, SourceCard };
