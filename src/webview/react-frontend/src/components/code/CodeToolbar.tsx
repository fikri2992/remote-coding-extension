import * as React from 'react'
import { cn } from '../../lib/utils'

export type FontSize = 'sm' | 'base' | 'lg'
export type CodeTheme = 'default' | 'neo' | 'one-dark'

export interface CodeToolbarProps {
  wrap: boolean
  lineNumbers: boolean
  indentGuides: boolean
  whitespace: boolean
  wrapColumn?: number
  fontSize: FontSize
  theme: CodeTheme
  language?: string
  languageOptions?: string[]
  onToggleWrap?: (next: boolean) => void
  onToggleLineNumbers?: (next: boolean) => void
  onToggleIndentGuides?: (next: boolean) => void
  onToggleWhitespace?: (next: boolean) => void
  onWrapColumnChange?: (col: number | undefined) => void
  onFontSizeChange?: (size: FontSize) => void
  onThemeChange?: (theme: CodeTheme) => void
  onLanguageChange?: (lang: string | undefined) => void
  onFindOpen?: () => void
  onGotoOpen?: () => void
  className?: string
}

export const CodeToolbar: React.FC<CodeToolbarProps> = ({
  wrap,
  lineNumbers,
  indentGuides,
  whitespace,
  wrapColumn,
  fontSize,
  theme,
  language,
  languageOptions = [],
  onToggleWrap,
  onToggleLineNumbers,
  onToggleIndentGuides,
  onToggleWhitespace,
  onWrapColumnChange,
  onFontSizeChange,
  onThemeChange,
  onLanguageChange,
  onGotoOpen,
  className
}) => {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 border-b border-border',
      'neo:border-b-[2px]',
      className
    )}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">View:</span>
          <button
            onClick={() => onToggleWrap?.(!wrap)}
            className={cn(
              'px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]',
              wrap ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={wrap}
          >
            {wrap ? 'Wrap' : 'Scroll'}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Col:</span>
            <input
              type="number"
              min={0}
              value={wrapColumn ?? 0}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                onWrapColumnChange?.(isNaN(v) || v <= 0 ? undefined : v)
              }}
              className="w-16 px-2 py-1 text-xs rounded border border-border bg-background neo:rounded-none neo:border-[2px]"
              title="Wrap column (0 = auto)"
            />
          </div>
          <button
            onClick={() => onToggleLineNumbers?.(!lineNumbers)}
            className={cn(
              'px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]',
              lineNumbers ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={lineNumbers}
          >
            Line #
          </button>
          <button
            onClick={() => onToggleIndentGuides?.(!indentGuides)}
            className={cn(
              'px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]',
              indentGuides ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={indentGuides}
          >
            Indent
          </button>
          <button
            onClick={() => onToggleWhitespace?.(!whitespace)}
            className={cn(
              'px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]',
              whitespace ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            aria-pressed={whitespace}
          >
            WS
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Size:</span>
          {(['sm', 'base', 'lg'] as const).map(s => (
            <button
              key={s}
              onClick={() => onFontSizeChange?.(s)}
              className={cn(
                'px-2 py-1 text-xs transition-colors rounded border border-border neo:rounded-none neo:border-[2px]',
                fontSize === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
              aria-pressed={fontSize === s}
            >
              {s === 'sm' ? 'S' : s === 'base' ? 'M' : 'L'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Theme:</span>
          {(['default', 'neo', 'one-dark'] as const).map(t => (
            <button
              key={t}
              onClick={() => onThemeChange?.(t)}
              className={cn(
                'px-2 py-1 text-xs transition-colors rounded border border-border capitalize neo:rounded-none neo:border-[2px]',
                theme === t ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
              aria-pressed={theme === t}
            >
              {t}
            </button>
          ))}
        </div>

        {languageOptions.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Lang:</span>
            <select
              className="px-2 py-1 text-xs rounded border border-border bg-background neo:rounded-none neo:border-[2px]"
              value={language || ''}
              onChange={e => onLanguageChange?.(e.target.value || undefined)}
            >
              <option value="">auto</option>
              {languageOptions.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onGotoOpen}
          className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]"
          title="Go to line (Ctrl/Cmd+G)"
        >Go</button>
      </div>
    </div>
  )
}
