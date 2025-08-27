/**
 * Build configuration for Vue.js frontend
 * This file provides build utilities and configuration for different environments
 * Updated for Vue.js implementation - replaces legacy vanilla JavaScript build system
 */

import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BUILD_MODES = {
  development: 'development',
  production: 'production'
}

const COMMANDS = {
  clean: 'npm run clean',
  typeCheck: 'npm run type-check',
  lint: 'npm run lint',
  format: 'npm run format:check',
  buildDev: 'npm run build:dev',
  buildProd: 'npm run build:prod'
}

/**
 * Execute a command and handle errors
 */
function executeCommand(command, description) {
  console.log(`\n🔄 ${description}...`)
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: '1' }
    })
    console.log(`✅ ${description} completed successfully`)
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message)
    process.exit(1)
  }
}

/**
 * Clean build directories
 * Removes Vue.js build output and temporary files
 */
export function clean() {
  const outDir = resolve(__dirname, '../../../out/webview/vue-frontend')
  const distDir = resolve(__dirname, 'dist')
  
  // Clean Vue.js build output directory
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true })
    console.log('✅ Cleaned Vue.js output directory')
  }
  
  // Clean Vite dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true })
    console.log('✅ Cleaned Vite dist directory')
  }
}

/**
 * Run quality checks (type checking, linting, formatting)
 */
export function qualityCheck() {
  executeCommand(COMMANDS.typeCheck, 'Type checking')
  executeCommand(COMMANDS.lint, 'Linting')
  executeCommand(COMMANDS.format, 'Format checking')
}

/**
 * Build for development
 * Creates optimized development build with source maps and debugging features
 */
export function buildDevelopment() {
  console.log('🚀 Building Vue.js frontend for development...')
  clean()
  qualityCheck()
  executeCommand(COMMANDS.buildDev, 'Vue.js development build')
  console.log('🎉 Vue.js development build completed!')
}

/**
 * Build for production
 * Creates optimized production build with minification and tree-shaking
 */
export function buildProduction() {
  console.log('🚀 Building Vue.js frontend for production...')
  clean()
  qualityCheck()
  executeCommand(COMMANDS.buildProd, 'Vue.js production build')
  console.log('🎉 Vue.js production build completed!')
}

/**
 * Main build function
 */
export function build(mode = 'production') {
  const buildMode = BUILD_MODES[mode] || BUILD_MODES.production
  
  if (buildMode === BUILD_MODES.development) {
    buildDevelopment()
  } else {
    buildProduction()
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'production'
  build(mode)
}