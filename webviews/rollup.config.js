import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import css from 'rollup-plugin-css-only';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = !process.env.ROLLUP_WATCH;


export default {
  input: path.resolve(__dirname, 'index.ts'),
  output: {
    sourcemap: true,
    format: 'es',
    file: path.resolve(__dirname, '../dist/webview.js')
  },
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        sourceMap: !production,
        typescript: {
          tsconfigFile: './tsconfig.json'
        }
      }),
      compilerOptions: {
        dev: !production
      }
    }),
    typescript({
      sourceMap: !production,
      inlineSources: !production,
      tsconfig: './tsconfig.json'
    }),
    css({ output: 'webview.css' }),
    resolve({
      browser: true,
      dedupe: ['svelte']
    }),
    commonjs(),
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
};