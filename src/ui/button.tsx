import { cn } from "@/utils/cn";
import { forwardRef } from "react";

// -- Types --------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
}

// -- Styles -------------------------------------------------------------------

const BASE_STYLES =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-composer-accent-dark hover:bg-composer-accent text-white",
  secondary: "bg-composer-button hover:bg-composer-button-hover text-composer-text",
  ghost: "text-composer-text-muted hover:text-composer-text hover:bg-composer-button",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  icon: "h-8 w-8 p-0",
};

const SIZE_STYLES_WITH_ICON: Record<ButtonSize, string> = {
  sm: "h-7 pl-2 pr-3 text-xs",
  md: "h-8 pl-2.5 pr-3.5 text-sm",
  icon: "h-8 w-8 p-0",
};

// -- Component ----------------------------------------------------------------

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", hasIcon = false, className, children, ...props }, ref) => {
    const sizeStyles = hasIcon ? SIZE_STYLES_WITH_ICON[size] : SIZE_STYLES[size];

    return (
      <button
        ref={ref}
        type="button"
        className={cn(BASE_STYLES, VARIANT_STYLES[variant], sizeStyles, className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

// -- Exports ------------------------------------------------------------------

export { Button };
export type { ButtonVariant, ButtonSize };
