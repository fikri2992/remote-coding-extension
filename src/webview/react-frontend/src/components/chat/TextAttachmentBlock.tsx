import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextAttachmentBlockProps {
  label?: string
  text: string
  initiallyCollapsed?: boolean
  className?: string
  alwaysShowToggle?: boolean
}

export const TextAttachmentBlock: React.FC<TextAttachmentBlockProps> = ({ text, className }) => {
  return (
    <pre className={cn('text-sm whitespace-pre-wrap break-words', className)}>
      {text}
    </pre>
  )
}

export default TextAttachmentBlock

