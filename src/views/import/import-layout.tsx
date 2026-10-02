// -- Constants ----------------------------------------------------------------

const SOURCE_GUTTER_WIDTH = 56;
const SOURCE_ROW_HEIGHT = 56;

// -- Components ---------------------------------------------------------------

const OrDivider: React.FC = () => (
  <div className="flex items-center gap-3 w-full max-w-md select-none">
    <div className="flex-1 h-px bg-composer-border" />
    <span className="text-xs text-composer-text-muted">or</span>
    <div className="flex-1 h-px bg-composer-border" />
  </div>
);

// -- Exports ------------------------------------------------------------------

export { SOURCE_GUTTER_WIDTH, SOURCE_ROW_HEIGHT, OrDivider };
