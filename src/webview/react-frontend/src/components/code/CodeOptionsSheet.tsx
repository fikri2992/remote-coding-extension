import * as React from 'react'
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../ui/bottom-sheet'
import { cn } from '../../lib/utils'

export type FontSize = 'sm' | 'base' | 'lg'
export type CodeTheme = 'default' | 'neo' | 'one-dark'

interface CodeOptionsSheetProps {
  open: boolean
  onClose: () => void
  wrap: boolean
  lineNumbers: boolean
  indentGuides: boolean
  whitespace: boolean
  wrapColumn?: number
  fontSize: FontSize
  theme: CodeTheme
  language?: string
  languageOptions?: string[]
  onToggleWrap: (next: boolean) => void
  onToggleLineNumbers: (next: boolean) => void
  onToggleIndentGuides: (next: boolean) => void
  onToggleWhitespace: (next: boolean) => void
  onWrapColumnChange: (col: number | undefined) => void
  onFontSizeChange: (size: FontSize) => void
  onThemeChange: (theme: CodeTheme) => void
  onLanguageChange: (lang: string | undefined) => void
  onCopyAll?: () => void
  onDownload?: () => void
}

export const CodeOptionsSheet: React.FC<CodeOptionsSheetProps> = ({
  open,
  onClose,
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
  onCopyAll,
  onDownload
}) => {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Viewer Options">
      <BottomSheetHeader>
        <BottomSheetTitle>Viewer Options</BottomSheetTitle>
        <button onClick={onClose} className="px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]">Close</button>
      </BottomSheetHeader>

      <div className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Toggles</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onToggleWrap(!wrap)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', wrap ? 'bg-primary text-primary-foreground' : 'bg-background')}>Wrap</button>
            <button onClick={() => onToggleLineNumbers(!lineNumbers)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', lineNumbers ? 'bg-primary text-primary-foreground' : 'bg-background')}>Line #</button>
            <button onClick={() => onToggleIndentGuides(!indentGuides)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', indentGuides ? 'bg-primary text-primary-foreground' : 'bg-background')}>Indent</button>
            <button onClick={() => onToggleWhitespace(!whitespace)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', whitespace ? 'bg-primary text-primary-foreground' : 'bg-background')}>Whitespace</button>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Actions</div>
          <div className="flex items-center gap-2">
            <button onClick={onCopyAll} className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]">Copy</button>
            <button onClick={onDownload} className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]">Download</button>
          </div>
        </div>
      </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Font Size</div>
          <div className="inline-flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
            {(['sm', 'base', 'lg'] as const).map(s => (
              <button key={s} onClick={() => onFontSizeChange(s)} className={cn('px-3 py-2 text-xs', fontSize === s ? 'bg-primary text-primary-foreground' : 'bg-background')}>{s === 'sm' ? 'S' : s === 'base' ? 'M' : 'L'}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Theme</div>
          <div className="inline-flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
            {(['default', 'neo', 'one-dark'] as const).map(t => (
              <button key={t} onClick={() => onThemeChange(t)} className={cn('px-3 py-2 text-xs capitalize', theme === t ? 'bg-primary text-primary-foreground' : 'bg-background')}>{t}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Wrap column</div>
          <input type="number" min={0} value={wrapColumn ?? 0} onChange={e => {
            const v = parseInt(e.target.value, 10)
            onWrapColumnChange(isNaN(v) || v <= 0 ? undefined : v)
          }} className="w-20 px-2 py-1 text-xs rounded border border-border bg-background neo:rounded-none neo:border-[2px]" />
        </div>

        {languageOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">Language</div>
            <select className="px-2 py-2 text-xs rounded border border-border bg-background neo:rounded-none neo:border-[2px]" value={language || ''} onChange={e => onLanguageChange(e.target.value || undefined)}>
              <option value="">auto</option>
              {languageOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      <BottomSheetFooter>
        <button onClick={onClose} className="px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]">Done</button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}

export default CodeOptionsSheet
