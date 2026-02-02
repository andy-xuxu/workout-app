import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/workout-app/', // GitHub Pages base path
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Copy sw.js and 404.html to dist folder
        {
          name: 'copy-assets',
          closeBundle() {
            copyFileSync('sw.js', 'dist/sw.js');
            copyFileSync('404.html', 'dist/404.html');
          }
        }
      ],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
