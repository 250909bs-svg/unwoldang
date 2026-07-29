import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// https://vitejs.dev/config/
// Codex exposes this repository through a Windows junction. Using the resolved
// physical root keeps Vite/Rollup from mixing junction and real paths while
// emitting index.html during production builds.
var projectRoot = realpathSync(fileURLToPath(new URL('.', import.meta.url)));
export default defineConfig({
    root: projectRoot,
    plugins: [react()],
});
