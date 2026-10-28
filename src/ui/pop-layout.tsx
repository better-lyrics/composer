import { Button, type ButtonProps } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { keepSpaceForFocusedControl } from "@/ui/keep-space-for-focused-control";
import { type Icon, IconChevronLeft, IconChevronRight, IconHandFinger } from "@tabler/icons-react";

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
  hint?: React.ReactNode;
  dimmed?: boolean;
  children: React.ReactNode;
}

interface PopNavButtonProps {
  label: string;
  icon: Icon;
  summary: React.ReactNode;
  onClick: () => void;
}

interface PopFieldLabelProps {
  id: string;
  value?: string;
  children: React.ReactNode;
}

interface PopIconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  icon: Icon;
}

// -- Constants -----------------------------------------------------------------

const FOCUSABLE_CONTROL = "button:not(:disabled), input:not(:disabled)";
const SET_BY_HAND_BUTTON = "[data-set-by-hand]";

// -- Helpers -------------------------------------------------------------------

// A view swap unmounts the focused control, so the new view takes focus unless one of its controls already did.
function focusIfFocusLost(body: HTMLDivElement | null, selector: string): void {
  if (!body || (document.activeElement !== null && document.activeElement !== document.body)) return;
  (body.querySelector<HTMLElement>(selector) ?? body.querySelector<HTMLElement>(FOCUSABLE_CONTROL))?.focus();
}

const FOCUS_ON_ENTER = {
  "first-control": (body: HTMLDivElement | null) => focusIfFocusLost(body, FOCUSABLE_CONTROL),
  "set-by-hand": (body: HTMLDivElement | null) => focusIfFocusLost(body, SET_BY_HAND_BUTTON),
} as const;

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

const PopBody: React.FC<{ focusOnEnter?: keyof typeof FOCUS_ON_ENTER; children: React.ReactNode }> = ({
  focusOnEnter = "first-control",
  children,
}) => (
  <div
    ref={FOCUS_ON_ENTER[focusOnEnter]}
    onKeyDown={keepSpaceForFocusedControl}
    className="w-95 p-1.5 text-[13px] leading-[1.3] text-(--label)"
  >
    {children}
  </div>
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
      {hint && (
        <span className="block mt-[3px] text-xs font-normal tabular-nums text-(--muted) whitespace-normal">{hint}</span>
      )}
    </span>
    {children}
  </div>
);

const PopNavButton: React.FC<PopNavButtonProps> = ({ label, icon: NavIcon, summary, onClick }) => (
  <Button
    variant="ghost"
    size="lg"
    hasIcon
    onClick={onClick}
    className="group justify-start gap-3 w-full h-auto min-h-9 pl-2.5 pr-1 rounded-lg text-left hover:bg-(--layer-2)"
  >
    <NavIcon aria-hidden="true" className="size-4 shrink-0 text-(--muted)" />
    <span className="flex-1 min-w-0 text-[13px] font-medium text-(--label)">{label}</span>
    <span className="flex items-center gap-2">
      {summary}
      <IconChevronRight
        aria-hidden="true"
        className="size-[15px] text-(--muted) transition-colors duration-150 group-hover:text-composer-text"
      />
    </span>
  </Button>
);

const PopFieldLabel: React.FC<PopFieldLabelProps> = ({ id, value, children }) => (
  <div className="flex justify-between items-baseline text-[12.5px] font-medium text-(--label)">
    <span id={id}>{children}</span>
    {value && <span className="font-mono text-[11px] font-medium tabular-nums text-(--muted)">{value}</span>}
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

const SetByHandButton: React.FC<{ variant?: ButtonProps["variant"]; onClick: () => void }> = ({ variant, onClick }) => (
  <PopButton variant={variant} icon={IconHandFinger} onClick={onClick} data-set-by-hand="">
    Set by hand
  </PopButton>
);

// -- Exports -------------------------------------------------------------------

export {
  PopActions,
  PopBody,
  PopButton,
  PopFieldLabel,
  PopGroup,
  PopHead,
  PopIconButton,
  PopNavButton,
  PopRow,
  PopText,
  SetByHandButton,
};
