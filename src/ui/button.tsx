import { type ButtonSize, type ButtonVariant, buttonClassName } from "@/ui/button-class-name";

// -- Types --------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  hasIcon?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

// -- Component ----------------------------------------------------------------

const Button: React.FC<ButtonProps> = ({ variant, size, hasIcon, className, children, ref, ...props }) => (
  <button ref={ref} type="button" className={buttonClassName({ variant, size, hasIcon, className })} {...props}>
    {children}
  </button>
);

// -- Exports ------------------------------------------------------------------

export { Button };
export type { ButtonProps };
