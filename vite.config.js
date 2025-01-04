import { defineConfig } from 'vite'
import dotenv from "dotenv";

import react from '@vitejs/plugin-react'

// defines where .env is stored at
dotenv.config({path: '.env'});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define:{
    'process': process
  }
})
