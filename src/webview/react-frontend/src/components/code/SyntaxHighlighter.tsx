import React from 'react'
import { cn } from '../../lib/utils'

// Basic HTML escaper to prevent HTML injection in code/diff rendering
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Safely apply syntax highlight patterns WITHOUT re-highlighting inside the
// markup we inject. We do this by working on an array of segments where only
// plain segments are processed by later patterns.
type HighlightPattern = { pattern: RegExp; className: string }
const applyHighlights = (escaped: string, patterns: HighlightPattern[]) => {
  type Seg = { text: string; classes?: string[] }
  let segs: Seg[] = [{ text: escaped }]
  patterns.forEach((p, idx) => {
    // Ensure global flag so we can iterate with RegExp.exec
    const base = p.pattern
    const flags = base.flags.includes('g') ? base.flags : base.flags + 'g'
    const re = new RegExp(base.source, flags)
    const next: Seg[] = []
    for (const seg of segs) {
      if (seg.classes) { next.push(seg); continue }
      const text = seg.text
      let last = 0
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        const start = m.index
        const end = start + m[0].length
        if (start > last) next.push({ text: text.slice(last, start) })
        next.push({ text: m[0], classes: [ `syntax-${idx}`, p.className ] })
        last = end
        if (m[0].length === 0) re.lastIndex++ // avoid infinite loops
      }
      if (last < text.length) next.push({ text: text.slice(last) })
    }
    segs = next
  })
  return segs.map(seg => seg.classes ? `<span class="${seg.classes.join(' ')}">${seg.text}</span>` : seg.text).join('')
}

// Language detection based on file extension or content
const detectLanguage = (filename: string, _content?: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'json':
      return 'json'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
    case 'scss':
    case 'sass':
      return 'css'
    case 'py':
      return 'python'
    case 'sh':
    case 'bash':
      return 'bash'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'xml':
      return 'xml'
    case 'sql':
      return 'sql'
    case 'go':
      return 'go'
    case 'rs':
      return 'rust'
    case 'php':
      return 'php'
    case 'rb':
      return 'ruby'
    case 'java':
      return 'java'
    case 'c':
      return 'c'
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp'
    default:
      return 'text'
  }
}

// Simple syntax highlighting patterns for common languages
const syntaxPatterns = {
  javascript: [
    { pattern: /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|default)\b/g, className: 'text-purple-600 dark:text-purple-400 font-semibold' },
    { pattern: /\b(true|false|null|undefined)\b/g, className: 'text-orange-600 dark:text-orange-400' },
    { pattern: /"([^"\\]|\\.)*"/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /'([^'\\]|\\.)*'/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /`([^`\\]|\\.)*`/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 dark:text-gray-400 italic' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 dark:text-gray-400 italic' },
    { pattern: /\b\d+\.?\d*\b/g, className: 'text-blue-600 dark:text-blue-400' },
  ],
  typescript: [
    { pattern: /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|default|interface|type|enum|namespace)\b/g, className: 'text-purple-600 dark:text-purple-400 font-semibold' },
    { pattern: /\b(string|number|boolean|any|void|never|unknown)\b/g, className: 'text-blue-600 dark:text-blue-400 font-semibold' },
    { pattern: /\b(true|false|null|undefined)\b/g, className: 'text-orange-600 dark:text-orange-400' },
    { pattern: /"([^"\\]|\\.)*"/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /'([^'\\]|\\.)*'/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /`([^`\\]|\\.)*`/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /\/\/.*$/gm, className: 'text-gray-500 dark:text-gray-400 italic' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 dark:text-gray-400 italic' },
    { pattern: /\b\d+\.?\d*\b/g, className: 'text-blue-600 dark:text-blue-400' },
  ],
  json: [
    { pattern: /"([^"\\]|\\.)*"(?=\s*:)/g, className: 'text-blue-600 dark:text-blue-400 font-medium' },
    { pattern: /"([^"\\]|\\.)*"(?!\s*:)/g, className: 'text-green-600 dark:text-green-400' },
    { pattern: /\b(true|false|null)\b/g, className: 'text-orange-600 dark:text-orange-400' },
    { pattern: /\b\d+\.?\d*\b/g, className: 'text-purple-600 dark:text-purple-400' },
  ],
  css: [
    { pattern: /([a-zA-Z-]+)(?=\s*:)/g, className: 'text-blue-600 dark:text-blue-400' },
    { pattern: /#[a-fA-F0-9]{3,6}\b/g, className: 'text-pink-600 dark:text-pink-400' },
    { pattern: /\b\d+(?:px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|fr)\b/g, className: 'text-purple-600 dark:text-purple-400' },
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-gray-500 dark:text-gray-400 italic' },
  ],
  markdown: [
    { pattern: /^#{1,6}\s.+$/gm, className: 'text-blue-600 dark:text-blue-400 font-bold' },
    { pattern: /\*\*([^*]+)\*\*/g, className: 'font-bold' },
    { pattern: /\*([^*]+)\*/g, className: 'italic' },
    { pattern: /`([^`]+)`/g, className: 'text-red-600 dark:text-red-400 bg-gray-100 dark:bg-gray-800 px-1 rounded' },
    { pattern: /\[([^\]]+)\]\([^)]+\)/g, className: 'text-blue-600 dark:text-blue-400 underline' },
  ]
}

interface SyntaxHighlighterProps {
  code: string
  language?: string
  filename?: string
  className?: string
  showLineNumbers?: boolean
  fontSize?: 'sm' | 'base' | 'lg'
  theme?: 'default' | 'neo'
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  code,
  language,
  filename = '',
  className,
  showLineNumbers = false,
  fontSize = 'base',
  theme = 'default'
}) => {
  const detectedLang = language || detectLanguage(filename, code)
  const patterns = syntaxPatterns[detectedLang as keyof typeof syntaxPatterns] || []
  
  // Apply syntax highlighting
  const highlightedCode = React.useMemo(() => {
    // Escape HTML first so raw tags render as text, not DOM nodes
    const escaped = escapeHtml(code)
    // Apply patterns safely without touching injected markup
    return applyHighlights(escaped, patterns)
  }, [code, patterns])
  
  const lines = highlightedCode.split('\n')
  
  const fontSizeClass = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
  }[fontSize]
  
  const themeClasses = theme === 'neo' 
    ? 'neo:border-[2px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
    : ''

  return (
    <div className={cn(
      'bg-background border border-border rounded-lg overflow-hidden',
      themeClasses,
      className
    )}>
      <div className="overflow-auto">
        <div className="min-w-full">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start hover:bg-muted/30 transition-colors',
                fontSize === 'sm' ? 'min-h-[20px]' : fontSize === 'base' ? 'min-h-[24px]' : 'min-h-[28px]'
              )}
            >
              {showLineNumbers && (
                <div className={cn(
                  'flex-shrink-0 w-12 text-right pr-3 py-1 text-muted-foreground select-none font-mono border-r border-border/50',
                  fontSizeClass
                )}>
                  {index + 1}
                </div>
              )}
              <div
                className={cn(
                  'flex-1 px-3 py-1 font-mono leading-relaxed',
                  fontSizeClass
                )}
                dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Enhanced diff line component with syntax highlighting
interface DiffLineProps {
  line: string
  type: 'add' | 'del' | 'ctx' | 'hunk' | 'meta'
  oldNo?: number | null
  newNo?: number | null
  filename?: string
  fontSize?: 'sm' | 'base' | 'lg'
  theme?: 'default' | 'neo'
  htmlOverride?: string
  wrap?: boolean
}

export const DiffLine: React.FC<DiffLineProps> = ({
  line,
  type,
  oldNo,
  newNo,
  filename = '',
  fontSize = 'base',
  htmlOverride,
  wrap
}) => {
  const content = line.slice(1) // Remove +/- prefix for syntax highlighting
  const prefix = line.charAt(0)
  
  const typeClasses = {
    add: 'bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500',
    del: 'bg-rose-50 dark:bg-rose-950/30 border-l-4 border-rose-500',
    ctx: 'hover:bg-muted/20',
    hunk: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium',
    meta: 'text-muted-foreground bg-muted/20'
  }
  
  const fontSizeClass = {
    sm: 'text-sm',
    base: 'text-base', 
    lg: 'text-lg'
  }[fontSize]
  
  // Apply syntax highlighting to the content (without prefix)
  const detectedLang = detectLanguage(filename)
  const patterns = syntaxPatterns[detectedLang as keyof typeof syntaxPatterns] || []
  
  const highlightedContent = React.useMemo(() => {
    // Always start from an escaped base to avoid rendering raw HTML
    const safeBase = escapeHtml(content)
    if (type === 'meta' || type === 'hunk') return safeBase
    if (htmlOverride) return htmlOverride
    
    // Apply patterns safely without re-highlighting inside injected markup
    return applyHighlights(safeBase, patterns)
  }, [content, patterns, type, htmlOverride])

  return (
    <div className={cn(
      'grid grid-cols-[4rem_4rem_1fr] items-start gap-x-2 px-2 py-1 transition-colors min-w-full',
      typeClasses[type],
      fontSize === 'sm' ? 'min-h-[20px]' : fontSize === 'base' ? 'min-h-[24px]' : 'min-h-[28px]'
    )}>
      <div className={cn(
        'text-right pr-1 text-muted-foreground select-none font-mono',
        fontSizeClass
      )}>
        {oldNo ?? ''}
      </div>
      <div className={cn(
        'text-right pr-1 text-muted-foreground select-none font-mono',
        fontSizeClass
      )}>
        {newNo ?? ''}
      </div>
      <div className={cn(
        'font-mono leading-relaxed flex items-start',
        fontSizeClass
      )} style={wrap ? undefined : { minWidth: 'max-content', tabSize: 2 }}>
        {(type === 'add' || type === 'del') && (
          <span className={cn(
            'inline-block w-4 flex-shrink-0',
            type === 'add' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}>
            {prefix}
          </span>
        )}
        <span
          className={cn('flex-1', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}
          dangerouslySetInnerHTML={{ __html: highlightedContent || '&nbsp;' }}
        />
      </div>
    </div>
  )
}
