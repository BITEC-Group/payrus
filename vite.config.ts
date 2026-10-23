import { execSync } from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
// Build stamp shown in Settings → About, so a test result can be tied to the exact deployed release (TCX-NEW-03).
const commit = process.env.APP_COMMIT ?? (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; } })();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "dev"),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  // GitHub Pages serves a project repo under /<repo-name>/, not domain root —
  // the deploy workflow sets GITHUB_PAGES=true; local dev and any other host
  // keep serving from root.
  base: process.env.GITHUB_PAGES ? "/payrus/" : "/",
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), tailwindcss(), hercules()],
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
