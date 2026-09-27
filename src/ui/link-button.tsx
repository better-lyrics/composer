import { type ButtonStyleOptions, buttonClassName } from "@/ui/button";
import { cn } from "@/utils/cn";
import { Link } from "react-router-dom";

// -- Types --------------------------------------------------------------------

interface LinkButtonBaseProps extends ButtonStyleOptions {
  children: React.ReactNode;
  disabled?: boolean;
}

type LinkButtonProps = LinkButtonBaseProps & ({ to: string; href?: undefined } | { href: string; to?: undefined });

// -- Component ----------------------------------------------------------------

const LinkButton: React.FC<LinkButtonProps> = (props) => {
  const { variant, size, hasIcon, className, disabled, children } = props;

  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        className={buttonClassName({
          variant,
          size,
          hasIcon,
          className: cn("opacity-50 cursor-not-allowed pointer-events-none", className),
        })}
      >
        {children}
      </span>
    );
  }

  const classes = buttonClassName({ variant, size, hasIcon, className });
  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <a href={props.href} className={classes}>
      {children}
    </a>
  );
};

// -- Exports ------------------------------------------------------------------

export { LinkButton };
