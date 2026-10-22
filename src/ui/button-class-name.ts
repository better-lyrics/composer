import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "latch" | "quiet" | "danger" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  className?: string;
}

// -- Styles -------------------------------------------------------------------

const BASE_STYLES =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-[background-color,color,scale] cursor-pointer active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "btn-lit",
  secondary:
    "btn-raised text-[var(--label)] hover:text-composer-text disabled:opacity-100 disabled:[background:var(--layer-1)] disabled:text-[color-mix(in_oklab,var(--label)_50%,transparent)] disabled:hover:text-[color-mix(in_oklab,var(--label)_50%,transparent)]",
  ghost: "text-[var(--muted)] hover:text-[var(--label)] hover:bg-[var(--layer-1)]",
  latch: "latch-on [&_svg]:text-composer-accent-text [&_[data-inline-key-badge]]:text-composer-accent-text",
  quiet:
    "text-composer-text/60 hover:text-composer-text hover:bg-[var(--layer-1)] [&_svg]:text-composer-text [&_svg]:opacity-60 [&_svg]:transition-opacity hover:[&_svg]:opacity-100",
  danger: "text-composer-negative hover:bg-composer-negative/14",
  destructive: "btn-danger",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-[13px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-9 px-3.5 text-[13px] rounded-xl",
  icon: "size-8 p-0",
};

const SIZE_STYLES_WITH_ICON: Record<ButtonSize, string> = {
  sm: "h-7 pl-2.5 pr-3 text-[13px]",
  md: "h-8 pl-2.5 pr-3 text-[13px]",
  lg: "h-9 pl-2.5 pr-3 text-[13px] rounded-xl",
  icon: "size-8 p-0",
};

// -- Recipe -------------------------------------------------------------------

function buttonClassName({ variant = "secondary", size = "md", hasIcon = false, className }: ButtonStyleOptions = {}) {
  const sizeStyles = hasIcon ? SIZE_STYLES_WITH_ICON[size] : SIZE_STYLES[size];
  return cn(BASE_STYLES, VARIANT_STYLES[variant], sizeStyles, className);
}

// -- Exports ------------------------------------------------------------------

export { buttonClassName };
export type { ButtonSize, ButtonStyleOptions, ButtonVariant };
