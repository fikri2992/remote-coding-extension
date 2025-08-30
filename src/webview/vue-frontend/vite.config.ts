import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  const isDev = mode === 'development'
  const isProd = mode === 'production'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@/components': resolve(__dirname, 'src/components'),
        '@/composables': resolve(__dirname, 'src/composables'),
        '@/stores': resolve(__dirname, 'src/stores'),
        '@/types': resolve(__dirname, 'src/types'),
        '@/utils': resolve(__dirname, 'src/utils'),
        '@/views': resolve(__dirname, 'src/views')
      }
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: isDev,
      // Define globals for webview environment
      global: 'globalThis',
      'process.env': {}
    },
    build: {
      outDir: '../../../out/webview/vue-frontend',
      emptyOutDir: true,
      target: 'es2020',
      minify: isProd ? 'esbuild' : false,
      sourcemap: isDev ? true : 'hidden',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                return 'vue-vendor'
              }
              if (id.includes('tailwindcss') || id.includes('postcss')) {
                return 'css-vendor'
              }
              return 'vendor'
            }
            
            // Feature-based chunks
            if (id.includes('file-system-menu')) {
              return 'file-system-menu'
            }
            if (id.includes('components/common')) {
              return 'common-components'
            }
            if (id.includes('stores')) {
              return 'stores'
            }
            if (id.includes('composables')) {
              return 'composables'
            }
            if (id.includes('services')) {
              return 'services'
            }
          },
          chunkFileNames: isProd ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          entryFileNames: isProd ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          assetFileNames: isProd ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]'
        }
      },
      chunkSizeWarningLimit: 500, // Stricter chunk size warning
      reportCompressedSize: isProd,
      assetsInlineLimit: 2048 // Smaller inline limit for better caching
    },
    server: {
      port: 5173,
      host: true,
      open: false,
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: env.VITE_WS_BASE_URL || 'ws://localhost:8081',
          ws: true,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 4173,
      host: true,
      cors: true
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia'],
      exclude: ['vue-demi']
    },
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
      legalComments: 'none', // Remove legal comments in production
      treeShaking: true
    },
    // Performance optimizations
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === 'js') {
          return { js: `"${filename}"` }
        } else {
          return { relative: true }
        }
      }
    }
  }
})