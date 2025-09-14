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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Inline and block code handling: keep <pre> ownership with react-markdown
          code({ inline, className, children, ...props }: any) {
            if (inline) {
              return (
                <code
                  className={
                    'px-1.5 py-0.5 bg-muted/50 border border-border rounded text-[0.85em] font-mono break-words whitespace-pre-wrap'
                  }
                  style={{
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    whiteSpace: 'break-spaces',
                    maxWidth: '100%',
                    display: 'inline-block',
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            // For fenced code blocks, react-markdown will render a <pre> wrapper.
            // We return just the code element here to avoid placing <pre> inside a <p>.
            return <code className={className} {...props}>{children}</code>
          },
          pre({ children, ...preProps }: any) {
            return (
              <pre
                className="bg-muted/40 border border-border rounded-lg p-3 overflow-auto text-xs leading-snug font-mono max-h-[520px]"
                {...preProps}
              >
                {children}
              </pre>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer

