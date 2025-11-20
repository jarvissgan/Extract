import { defineConfig } from "vite";
import dotenv from "dotenv";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// defines where .env is stored at
dotenv.config({ path: `${__dirname}/.env`, override: "true" });

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    process: process,
  },
  
});
