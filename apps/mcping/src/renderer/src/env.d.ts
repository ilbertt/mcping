/// <reference types="vite/client" />
import type { McpingApi } from '#shared/types.ts';

declare global {
  interface Window {
    mcping: McpingApi;
  }
}
