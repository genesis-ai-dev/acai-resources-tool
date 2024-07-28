import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use an environment variable to specify the app to build
const appToBuild = process.env.APP_NAME;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: `src/${appToBuild}/index.tsx`,
      output: {
        // Specify naming conventions here without a hash
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
    outDir: appToBuild ? `dist/${appToBuild}` : "dist",
  },
});

// //this is a new alternative
//
// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// // Use an environment variable to specify the app to build
// const appToBuild = process.env.APP_NAME || 'ACAIResourceView';

// export default defineConfig({
//     plugins: [react()],
//     build: {
//         outDir: `../dist/${appToBuild}`,
//         rollupOptions: {
//             input: `src/${appToBuild}/index.tsx`,
//             output: {
//                 entryFileNames: 'index.js',
//                 assetFileNames: 'index.[ext]'
//             },
//         },
//     },
// });
