/// <reference types="vite/client" />
import type { McpingApi } from '#shared/api.ts';

declare global {
  interface Window {
    mcping: McpingApi;
  }
}
