import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Use an environment variable to specify the app to build
const appToBuild = process.env.APP_NAME || "ACAIResourceView";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, `../dist/webviews/${appToBuild}`),
    emptyOutDir: true,
    rollupOptions: {
      input: `src/${appToBuild}/index.tsx`,
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
