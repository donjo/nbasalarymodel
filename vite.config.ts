import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";

export default defineConfig({
  plugins: [fresh()],
  server: {
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
    format: "esm",
  },
});
