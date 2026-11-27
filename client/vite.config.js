import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = Object.fromEntries(["/api", "/robots.txt", "/sitemap.xml"].map(path => [
  path, { target: "http://127.0.0.1:4000", changeOrigin: true },
]));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: apiProxy,
  },
  preview: { proxy: apiProxy },
});
