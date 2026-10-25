import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy en desarrollo: el frontend llama a /api y Vite lo reenvia a la
    // API local. Evita configurar CORS y cookies cross-site mientras se
    // desarrolla. En produccion se usa VITE_API_URL (dominio de Render).
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
