/// <reference types="vite/client" />

// biome-ignore lint/correctness/noUnusedVariables: augments Vite's global ImportMetaEnv.
interface ImportMetaEnv {
  // Injected from the installed onnxruntime-web package by vite.config.ts.
  readonly VITE_ORT_VERSION: string;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare const __APP_VERSION__: string;
