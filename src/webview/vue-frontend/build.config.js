/**
 * Build configuration for Vue frontend
 * This file provides build utilities and configuration for different environments
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
 */
export function clean() {
  const outDir = resolve(__dirname, '../../../out/webview/vue-frontend')
  const distDir = resolve(__dirname, 'dist')
  
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true })
    console.log('✅ Cleaned output directory')
  }
  
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true })
    console.log('✅ Cleaned dist directory')
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
 */
export function buildDevelopment() {
  console.log('🚀 Building Vue frontend for development...')
  clean()
  qualityCheck()
  executeCommand(COMMANDS.buildDev, 'Development build')
  console.log('🎉 Development build completed!')
}

/**
 * Build for production
 */
export function buildProduction() {
  console.log('🚀 Building Vue frontend for production...')
  clean()
  qualityCheck()
  executeCommand(COMMANDS.buildProd, 'Production build')
  console.log('🎉 Production build completed!')
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