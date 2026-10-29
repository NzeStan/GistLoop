/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { brand } from "./src/config/brand.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Applies src/config/brand.ts to the HTML shell at build (and dev) time: colours as CSS variables
 * (no flash of the wrong colours), favicon, font, social-sharing tags and the web app manifest.
 */
function brandPlugin(): Plugin {
  const head = () => {
    const title = `${brand.name} — ${brand.tagline}`;
    const fontOrigin = new URL(brand.font.stylesheet).origin;
    return [
      `<title>${escape(title)}</title>`,
      `<meta name="description" content="${escape(brand.description)}" />`,
      `<meta name="theme-color" content="${brand.colors.primary}" />`,
      `<meta name="application-name" content="${escape(brand.name)}" />`,
      `<meta property="og:site_name" content="${escape(brand.name)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${escape(title)}" />`,
      `<meta property="og:description" content="${escape(brand.description)}" />`,
      `<meta property="og:image" content="${escape(brand.assets.socialShare)}" />`,
      `<meta property="og:url" content="${escape(brand.siteUrl)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="${escape(brand.assets.socialShare)}" />`,
      `<link rel="icon" href="${escape(brand.assets.favicon)}" />`,
      `<link rel="apple-touch-icon" href="${escape(brand.assets.appleTouchIcon)}" />`,
      `<link rel="manifest" href="/site.webmanifest" />`,
      `<link rel="preconnect" href="${fontOrigin}" />`,
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
      `<link rel="stylesheet" href="${escape(brand.font.stylesheet)}" />`,
      `<style id="brand-tokens">:root{--brand-primary:${brand.colors.primary};--brand-accent:${brand.colors.accent};--font-sans:${brand.font.family};}</style>`,
    ].join("\n    ");
  };
  const manifest = () =>
    JSON.stringify(
      {
        name: brand.name,
        short_name: brand.name,
        description: brand.description,
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: brand.colors.primary,
        icons: [
          { src: brand.assets.icon192, sizes: "192x192", type: "image/png" },
          { src: brand.assets.icon512, sizes: "512x512", type: "image/png" },
        ],
      },
      null,
      2,
    );
  return {
    name: "gistloop-brand",
    transformIndexHtml: (html) => html.replace("<!--brand-head-->", head()),
    configureServer(server) {
      server.middlewares.use("/site.webmanifest", (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json");
        res.end(manifest());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "site.webmanifest", source: manifest() });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:8000";
  // In development the Django API runs separately; proxying keeps everything same-origin, exactly
  // like production behind a reverse proxy (so the httpOnly sign-in cookie just works).
  const proxied = ["/api", "/bff", "/health", "/admin", "/static", "/schema", "/media"];
  return {
    plugins: [react(), brandPlugin()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5173,
      strictPort: true,
      proxy: Object.fromEntries(proxied.map((path) => [path, { target: backend, changeOrigin: false }])),
    },
    preview: { port: 4173 },
    build: {
      target: "es2022",
      sourcemap: "hidden",
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return "react";
            if (id.includes("@tanstack")) return "query";
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      restoreMocks: true,
    },
  };
});
