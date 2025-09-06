import * as React from 'react'
import {
  Folder,
  File,
  FileText,
  Settings,
  Database,
  Image,
  Archive,
  Code,
  FileJson,
  GitBranch,
  Package,
  Terminal,
  Lock,
  Globe,
  Palette
} from 'lucide-react'

export type NodeType = 'file' | 'directory'

// Mobile-friendly icon mapping with clear, consistent colors.
// Keep shapes simple and recognizable at 16–20px.
export function getFileIcon(name: string, type: NodeType): React.ReactElement {
  const base = 'w-5 h-5' // FileNodeItem will override size when needed
  const lower = name.toLowerCase()

  if (type === 'directory') {
    if (lower === 'node_modules') return <Package className={`${base} text-amber-600`} />
    if (lower === '.git') return <GitBranch className={`${base} text-orange-600`} />
    if (lower === 'public' || lower === 'static') return <Globe className={`${base} text-blue-600`} />
    if (lower === 'src' || lower === 'source') return <Code className={`${base} text-purple-600`} />
    if (lower === 'docs' || lower === 'documentation') return <FileText className={`${base} text-green-600`} />
    if (lower === 'assets' || lower === 'images') return <Image className={`${base} text-pink-600`} />
    return <Folder className={`${base} text-blue-500`} />
  }

  // Special filenames
  if (lower === 'package.json' || lower === 'package-lock.json') return <Package className={`${base} text-red-600`} />
  if (lower === 'dockerfile' || lower.startsWith('docker')) return <Archive className={`${base} text-blue-600`} />
  if (lower === 'readme.md' || lower === 'readme') return <FileText className={`${base} text-green-600`} />
  if (lower.startsWith('.env')) return <Settings className={`${base} text-yellow-600`} />
  if (lower.startsWith('.git')) return <GitBranch className={`${base} text-orange-600`} />
  if (lower === 'caddyfile') return <Settings className={`${base} text-blue-600`} />
  if (lower.includes('config')) return <Settings className={`${base} text-gray-600`} />

  // Extensions
  const ext = lower.includes('.') ? lower.split('.').pop() : ''
  switch (ext) {
    case 'js':
    case 'jsx':
      return <Code className={`${base} text-yellow-500`} />
    case 'ts':
    case 'tsx':
      return <Code className={`${base} text-blue-500`} />
    case 'json':
      return <FileJson className={`${base} text-orange-500`} />
    case 'md':
    case 'markdown':
      return <FileText className={`${base} text-gray-600`} />
    case 'html':
    case 'htm':
      return <Globe className={`${base} text-orange-600`} />
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <Palette className={`${base} text-cyan-600`} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className={`${base} text-fuchsia-600`} />
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
      return <Archive className={`${base} text-gray-600`} />
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return <Terminal className={`${base} text-emerald-600`} />
    case 'lock':
      return <Lock className={`${base} text-red-600`} />
    case 'toml':
    case 'yaml':
    case 'yml':
    case 'xml':
      return <Database className={`${base} text-blue-500`} />
    default:
      if (ext && ext.length <= 3) {
        const mono = ext.toUpperCase()
        return (
          <span className={`inline-flex items-center justify-center ${base} rounded-sm border border-border/50 text-[9px] font-semibold text-muted-foreground bg-muted/30`}>
            {mono}
          </span>
        )
      }
      return <File className={`${base} text-gray-500`} />
  }
}
