/// <reference types="vite/client" />

declare module "*.css" {
  const content: string;
  export default content;
}

declare const __APP_VERSION__: string;
declare const __ORT_VERSION__: string;
