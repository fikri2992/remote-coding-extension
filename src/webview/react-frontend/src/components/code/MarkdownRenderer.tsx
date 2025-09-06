import * as React from 'react'

export const MarkdownRenderer: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  const [RM, setRM] = React.useState<any>(null)
  const [gfm, setGfm] = React.useState<any>(null)
  React.useEffect(() => {
    let alive = true
    Promise.all([
      import('react-markdown'),
      import('remark-gfm')
    ]).then(([rm, g]) => {
      if (!alive) return
      setRM(() => rm.default || (rm as any))
      setGfm(() => g.default || (g as any))
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!RM) {
    return (
      <div className={className}>
        <div className="text-xs text-muted-foreground px-3 py-2">Loading preview…</div>
      </div>
    )
  }
  const ReactMarkdown = RM
  const remarkGfm = gfm
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer

