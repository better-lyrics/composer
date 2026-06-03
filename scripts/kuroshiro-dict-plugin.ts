import { copyFile, mkdir, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DICT_DIR = resolve(PROJECT_ROOT, "node_modules/kuroshiro-browser/dist/dict");

// kuroshiro-browser fetches its dictionaries at `./dict/*.dat.br` and
// constructs `new Int32Array(arrayBuffer)` from the response. That requires
// the bytes to be the raw `.dat` payload, not brotli-compressed. In dev we
// stream the `.br` files with `Content-Encoding: br` so the browser
// transparently decompresses. At build time we decompress the files
// ourselves and write the raw bytes under the original `.br` filename so
// production hosts can serve them as static assets without any
// `Content-Encoding` gymnastics (which Cloudflare Workers Static Assets
// strips on responses originating from the assets binding).
function kuroshiroDictPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;
  return {
    name: "composer:kuroshiro-dict",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use("/dict", (req, res, next) => {
        const file = (req.url ?? "").split("?")[0];
        if (!file || !file.endsWith(".br")) {
          next();
          return;
        }
        const fullPath = resolve(SOURCE_DICT_DIR, `.${file}`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Encoding", "br");
        createReadStream(fullPath)
          .on("error", () => next())
          .pipe(res);
      });
    },
    async closeBundle() {
      if (!resolvedConfig || resolvedConfig.command !== "build") return;
      const outDir = resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const destDictDir = resolve(outDir, "dict");
      await mkdir(destDictDir, { recursive: true });
      const entries = await readdir(SOURCE_DICT_DIR);
      await Promise.all(entries.map((name) => copyFile(resolve(SOURCE_DICT_DIR, name), resolve(destDictDir, name))));
    },
  };
}

export { kuroshiroDictPlugin };
