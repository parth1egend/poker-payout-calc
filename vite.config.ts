import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const defaultBase = process.env.GITHUB_PAGES === "true" && repoName ? `/${repoName}/` : "/";
const base = process.env.VITE_BASE_PATH ?? defaultBase;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.svg"],
      manifest: {
        name: "Poker Settlement",
        short_name: "Poker Settle",
        description: "Offline-first poker finance and settlement tracker for buy-ins, payouts, and final transfers.",
        theme_color: "#102019",
        background_color: "#f3eee2",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
