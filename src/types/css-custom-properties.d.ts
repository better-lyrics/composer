import "react";

// Theme-scoped colours that utilities in src/index.css read, set per element.
declare module "react" {
  interface CSSProperties {
    "--agent"?: string;
    "--group"?: string;
    // Loupe size layer geometry, derived from the live size and window.
    "--loupe-bar-top"?: string;
    "--loupe-card-top"?: string;
    "--loupe-canvas-w"?: string;
    "--loupe-canvas-h"?: string;
  }
}
