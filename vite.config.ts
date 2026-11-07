import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'lucide';
          }
          if (id.includes('node_modules/qrcode.react/')) {
            return 'qrcode';
          }
          if (id.includes('src/components/charts/')) {
            return 'charts';
          }
        },
      },
    },
  },
});
