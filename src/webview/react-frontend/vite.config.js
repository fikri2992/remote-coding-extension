import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/ws': {
                target: 'http://localhost:3900',
                ws: true,
                secure: false,
                changeOrigin: true,
            },
        },
    },
});
