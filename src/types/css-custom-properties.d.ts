import "react";

// Theme-scoped colours that utilities in src/index.css read, set per element.
declare module "react" {
  interface CSSProperties {
    "--agent"?: string;
    "--group"?: string;
  }
}
