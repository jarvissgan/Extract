import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// pdf.js needs its cMaps and standard fonts to read text in some PDFs (bank statements
// included). Serve them at /pdfjs/ in dev and copy them into the build.
const pdfjsDir = path.resolve("node_modules/pdfjs-dist");
const PDFJS_DIRS = ["cmaps", "standard_fonts"];
const pdfjsAssets = (): Plugin => ({
  name: "pdfjs-assets",
  configureServer(server) {
    server.middlewares.use("/pdfjs", (req, res, next) => {
      const [dir, file] = (req.url ?? "").split("?")[0].replace(/^\//, "").split("/");
      if (!PDFJS_DIRS.includes(dir) || !file || !/^[\w.-]+$/.test(file)) return next();
      try {
        res.end(readFileSync(path.join(pdfjsDir, dir, file)));
      } catch {
        next();
      }
    });
  },
  generateBundle() {
    for (const dir of PDFJS_DIRS) {
      for (const file of readdirSync(path.join(pdfjsDir, dir))) {
        this.emitFile({ type: "asset", fileName: `pdfjs/${dir}/${file}`, source: readFileSync(path.join(pdfjsDir, dir, file)) });
      }
    }
  },
});

// Vite reads .env from the project root and only exposes variables that start
// with VITE_ to the browser. Never put secrets in VITE_ variables.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          mantine: ["@mantine/core", "@mantine/hooks", "@mantine/notifications", "@mantine/modals"],
          auth: ["@auth0/auth0-react"],
        },
      },
    },
  },
});
