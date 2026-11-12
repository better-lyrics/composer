// -- Constants ----------------------------------------------------------------

// aria-disabled instead of disabled, so the control keeps focus and its reason tooltip opens from the keyboard.
const UNAVAILABLE_PROPS = {
  "aria-disabled": true,
  onClick: (event: React.MouseEvent) => event.preventDefault(),
} as const;

// -- Functions ----------------------------------------------------------------

function unavailableProps(reason: string | undefined): typeof UNAVAILABLE_PROPS | undefined {
  return reason === undefined ? undefined : UNAVAILABLE_PROPS;
}

// -- Exports ------------------------------------------------------------------

export { unavailableProps };
