import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(() => {
    // Use environment variable for base path, default to '/' for Vercel
    // Set VITE_BASE_PATH=/workout-app/ for GitHub Pages deployment
    const basePath = process.env.VITE_BASE_PATH || '/';
    
    return {
      base: basePath,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Copy sw.js, 404.html, manifest.json, and .nojekyll to dist folder
        {
          name: 'copy-assets',
          closeBundle() {
            copyFileSync('sw.js', 'dist/sw.js');
            copyFileSync('404.html', 'dist/404.html');
            copyFileSync('manifest.json', 'dist/manifest.json');
            // Create .nojekyll file to disable Jekyll processing on GitHub Pages
            if (existsSync('.nojekyll')) {
              copyFileSync('.nojekyll', 'dist/.nojekyll');
            } else {
              writeFileSync('dist/.nojekyll', '');
            }
          }
        }
      ],
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html')
          }
        }
      }
    };
});
