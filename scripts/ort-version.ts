import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// onnxruntime-web's `exports` map hides package.json from `import`, so read it
// from disk. The worker uses this to fetch CDN runtime files that match the
// bundled JS exactly.
function readOrtVersion(root: string): string {
  const pkgPath = resolve(root, "node_modules/onnxruntime-web/package.json");
  return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;
}

export { readOrtVersion };
