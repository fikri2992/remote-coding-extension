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
        // Ensure dev server is reachable from network if needed
        host: 'localhost',
        proxy: {
            '/ws': {
                // Use ws scheme for clarity; http works too for upgrade
                target: 'ws://localhost:3900',
                ws: true,
                secure: false,
                changeOrigin: true,
                configure: function (proxy) {
                    // Swallow initial ECONNREFUSED noise while backend boots
                    proxy.on('error', function (err) {
                        if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNREFUSED')
                            return;
                        // eslint-disable-next-line no-console
                        console.warn('[vite-proxy] ws error:', (err === null || err === void 0 ? void 0 : err.message) || String(err));
                    });
                },
            },
        },
    },
});
