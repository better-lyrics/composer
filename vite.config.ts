import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import "vite-react-ssg";
import ortPkg from "./node_modules/onnxruntime-web/package.json";
import pkg from "./package.json";
import { writeSeoAssets } from "./scripts/build-seo-assets";

const SITE_ORIGIN = "https://composer.betterlyrics.org";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __ORT_VERSION__: JSON.stringify(ortPkg.version),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
    conditions: ["onnxruntime-web-use-extern-wasm", "import", "module", "browser", "default"],
  },
  // Listening on IPv4 serves both localhost and 127.0.0.1, which the local preview frame needs.
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        "preview-frame": resolve(__dirname, "preview-frame.html"),
      },
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  ssgOptions: {
    formatting: "none",
    crittersOptions: false,
    async onFinished(outDir) {
      await writeSeoAssets(outDir, SITE_ORIGIN);
    },
  },
});
