import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from "buffer";
// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  resolve: {
    alias: {
      process: "process/browser"
    }
  },
  plugins: [react()],
  base: "/app",
  optimizeDeps: {
    exclude: ["@xmtp/browser-sdk"],
    include: ["@xmtp/proto"],
  },
})
