import { type ButtonSize, type ButtonVariant, buttonClassName } from "@/ui/button-class-name";
import { Tooltip } from "@/ui/tooltip";
import { unavailableProps } from "@/ui/unavailable-props";

// -- Types --------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  /** Makes the button unavailable and explains why in a tooltip that also opens on keyboard focus. */
  disabledReason?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

// -- Component ----------------------------------------------------------------

const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  hasIcon,
  disabledReason,
  className,
  children,
  ref,
  ...props
}) => {
  const button = (
    <button
      ref={ref}
      type="button"
      className={buttonClassName({ variant, size, hasIcon, className })}
      {...props}
      {...unavailableProps(disabledReason)}
    >
      {children}
    </button>
  );
  return disabledReason === undefined ? button : <Tooltip content={disabledReason}>{button}</Tooltip>;
};

// -- Exports ------------------------------------------------------------------

export { Button };
export type { ButtonProps };
