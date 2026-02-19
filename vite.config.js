import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Ensure .glb, .mp3, and other assets are bundled correctly
  assetsInclude: ['**/*.glb', '**/*.mp3', '**/*.wav', '**/*.png', '**/*.jpg'],
  build: {
    // Optional: increase asset inlining limit to avoid issues with small files
    assetsInlineLimit: 0,
  },
});
