import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite reads .env from the project root and only exposes variables that start
// with VITE_ to the browser. Never put secrets in VITE_ variables.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
