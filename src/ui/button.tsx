import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

// -- Styles -------------------------------------------------------------------

const BASE_STYLES =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-composer-accent-dark hover:bg-composer-accent text-composer-on-accent",
  secondary: "bg-composer-button hover:bg-composer-button-hover text-composer-text",
  ghost: "text-composer-text-muted hover:text-composer-text hover:bg-composer-button",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  icon: "size-8 p-0",
};

const SIZE_STYLES_WITH_ICON: Record<ButtonSize, string> = {
  sm: "h-7 pl-2 pr-3 text-xs",
  md: "h-8 pl-2.5 pr-3.5 text-sm",
  icon: "size-8 p-0",
};

// -- Recipe -------------------------------------------------------------------

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  className?: string;
}

function buttonClassName({ variant = "secondary", size = "md", hasIcon = false, className }: ButtonStyleOptions) {
  const sizeStyles = hasIcon ? SIZE_STYLES_WITH_ICON[size] : SIZE_STYLES[size];
  return cn(BASE_STYLES, VARIANT_STYLES[variant], sizeStyles, className);
}

// -- Component ----------------------------------------------------------------

const Button: React.FC<ButtonProps> = ({ variant, size, hasIcon, className, children, ref, ...props }) => (
  <button ref={ref} type="button" className={buttonClassName({ variant, size, hasIcon, className })} {...props}>
    {children}
  </button>
);

// -- Exports ------------------------------------------------------------------

export { Button, buttonClassName };
export type { ButtonProps, ButtonStyleOptions };
