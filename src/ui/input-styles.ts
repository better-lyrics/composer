// -- Constants ----------------------------------------------------------------

const INPUT_BASE_STYLES =
  "px-2.5 py-1.5 text-[13px] rounded-lg cursor-text border border-(--edge) text-composer-text placeholder:text-(--muted) focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

const INPUT_STYLES = `${INPUT_BASE_STYLES} bg-(--well) focus:bg-[color-mix(in_oklab,var(--ink)_6%,var(--well))]`;

const FLOATING_INPUT_STYLES = `${INPUT_BASE_STYLES} bg-transparent focus:bg-[color-mix(in_oklab,var(--ink)_6%,var(--pop))]`;

// -- Exports ------------------------------------------------------------------

export { FLOATING_INPUT_STYLES, INPUT_STYLES };
