import { Button, type ButtonProps } from "@/ui/button";

// -- Types --------------------------------------------------------------------

interface ToggleButtonProps extends Omit<ButtonProps, "variant"> {
  pressed: boolean;
  // ARIA advises against aria-pressed on a toggle whose visible label already changes with its state.
  stateInLabel?: boolean;
}

// -- Component ----------------------------------------------------------------

const ToggleButton: React.FC<ToggleButtonProps> = ({ pressed, stateInLabel = false, className, ...props }) => (
  <Button
    variant={pressed ? "latch" : "ghost"}
    aria-pressed={stateInLabel ? undefined : pressed}
    className={className}
    {...props}
  />
);

// -- Exports ------------------------------------------------------------------

export { ToggleButton };
