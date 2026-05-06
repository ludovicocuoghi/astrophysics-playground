import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: clientRoot,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5179,
    proxy: {
      "/api": "http://127.0.0.1:4279"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
