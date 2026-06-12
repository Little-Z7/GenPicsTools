/// <reference types="vite/client" />

import type { AiImageToolApi } from "../preload/preload";

declare global {
  interface Window {
    aiImageTool: AiImageToolApi;
  }
}
