import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BloodLink Vite configuration
// - port 3000: the platform dev server / preview expects this port
// - host + allowedHosts: accept requests through the preview proxy
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    allowedHosts: true
  }
});
