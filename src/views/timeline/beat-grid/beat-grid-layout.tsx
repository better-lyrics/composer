import { Button, type ButtonProps } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { type Icon, IconChevronLeft } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface PopHeadProps {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  onBack?: () => void;
}

interface PopButtonProps extends Omit<ButtonProps, "size" | "hasIcon"> {
  icon?: Icon;
}

interface PopRowProps {
  label: React.ReactNode;
  icon?: Icon;
  hint?: string;
  dimmed?: boolean;
  children: React.ReactNode;
}

interface PopIconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  icon: Icon;
}

// -- Components ----------------------------------------------------------------

const PopIconButton: React.FC<PopIconButtonProps> = ({ icon: ActionIcon, className, ...props }) => (
  <IconButton
    variant="ghost"
    icon={<ActionIcon aria-hidden="true" className="size-4" />}
    className={cn("size-7 shrink-0 hover:bg-(--layer-2) hover:text-composer-text", className)}
    {...props}
  />
);

const PopHead: React.FC<PopHeadProps> = ({ title, meta, action, onBack }) => (
  <div className={cn("flex items-center gap-1.5 box-content min-h-7 pt-1.5 pr-1", onBack ? "pl-0" : "pl-2.5")}>
    {onBack && <PopIconButton label="Back" icon={IconChevronLeft} onClick={onBack} className="ml-1" />}
    <span className="flex-1 text-[13.5px] font-semibold text-composer-text">{title}</span>
    {meta && (
      <span className="pr-1.5 font-mono text-[11.5px] font-medium tabular-nums text-composer-accent-text">{meta}</span>
    )}
    {action}
  </div>
);

const PopText: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn("px-2.5 text-[12.5px] leading-normal text-(--muted) text-pretty", className)}>{children}</p>
);

const PopActions: React.FC<{ children: React.ReactNode; split?: boolean; className?: string }> = ({
  children,
  split,
  className,
}) => (
  <div className={cn("flex gap-2 px-1 pb-1", split ? "justify-between" : "justify-end", className)}>{children}</div>
);

const PopBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-85 p-1.5 text-[13px] leading-[1.3] text-(--label)">{children}</div>
);

const PopGroup: React.FC<{ label?: string; className?: string; children: React.ReactNode }> = ({
  label,
  className,
  children,
}) => (
  <div className={cn("grid gap-1 mt-3", className)}>
    {label && <div className="px-2.5 mb-0.5 text-xs leading-[1.3] font-medium text-(--muted)">{label}</div>}
    {children}
  </div>
);

const PopRow: React.FC<PopRowProps> = ({ label, icon: RowIcon, hint, dimmed, children }) => (
  <div className={cn("flex items-center gap-3 min-h-9 pl-2.5 pr-1", hint && "py-1.5")}>
    {RowIcon && <RowIcon aria-hidden="true" className="size-4 shrink-0 text-(--muted)" />}
    <span
      className={cn(
        "flex-1 min-w-0 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
        dimmed ? "text-(--muted)" : "text-(--label)",
      )}
    >
      {label}
      {hint && <span className="block mt-[3px] text-xs font-normal text-(--muted) whitespace-normal">{hint}</span>}
    </span>
    {children}
  </div>
);

const PopButton: React.FC<PopButtonProps> = ({ icon: ButtonIcon, variant, className, children, ...props }) => (
  <Button
    size="sm"
    variant={variant}
    hasIcon={ButtonIcon !== undefined}
    className={cn("text-[12.5px]", variant !== "primary" && "[&>svg]:text-(--muted)", className)}
    {...props}
  >
    {ButtonIcon && <ButtonIcon aria-hidden="true" className="size-[15px]" />}
    {children}
  </Button>
);

// -- Exports -------------------------------------------------------------------

export { PopActions, PopBody, PopButton, PopGroup, PopHead, PopIconButton, PopRow, PopText };
