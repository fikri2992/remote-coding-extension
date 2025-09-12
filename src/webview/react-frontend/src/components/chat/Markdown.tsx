import React from 'react';

// Minimal, safe-ish Markdown renderer without external deps.
// Supports headings (#), lists (-, *), code fences (```), inline `code`, and links [text](url).
// Escapes HTML to avoid XSS.

type MarkdownProps = { text: string; className?: string };

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(md: string): string {
  // inline code
  let out = md.replace(/`([^`]+)`/g, (_m, p1) => `<code class="px-1.5 py-0.5 bg-muted/50 border border-border rounded text-[0.85em] font-mono">${escapeHtml(p1)}</code>`);
  // links
  out = out.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, (_m, label, url) => {
    const safeUrl = escapeHtml(url);
    const safeLabel = escapeHtml(label);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer" class="underline decoration-2 underline-offset-2 hover:opacity-90">${safeLabel}</a>`;
  });
  return out;
}

function renderBlocks(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inCode = false; let codeLang = '';
  let inList = false;

  const flushList = () => { if (inList) { html.push('</ul>'); inList = false; } };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '  ');
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        flushList();
        codeLang = line.trim().slice(3).trim();
        html.push(`<pre class="bg-muted/40 border border-border rounded-lg p-3 overflow-auto text-xs leading-snug font-mono max-h-[520px]"><code>`);
        inCode = true;
      } else {
        html.push('</code></pre>');
        inCode = false; codeLang = '';
      }
      continue;
    }
    if (inCode) { html.push(escapeHtml(raw)); continue; }

    // list items (dash, star, or bullet dot)
    if (/^\s*([-*•])\s+/.test(line)) {
      if (!inList) { html.push('<ul class="list-disc pl-6">'); inList = true; }
      const item = line.replace(/^\s*([-*•])\s+/, '');
      html.push(`<li>${renderInline(escapeHtml(item))}</li>`);
      continue;
    } else {
      flushList();
    }

    // headings
    const m = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (m) {
      const lvl = Math.min(6, m[1].length);
      const cls = lvl <= 2 ? 'text-base font-semibold mt-3 mb-1' : (lvl === 3 ? 'text-[0.95rem] font-semibold mt-3 mb-1' : 'text-sm font-semibold mt-2 mb-1');
      html.push(`<h${lvl} class="${cls}">${renderInline(escapeHtml(m[2]))}</h${lvl}>`);
      continue;
    }

    // paragraph or blank
    if (line.trim().length === 0) { html.push('<div class="h-2"></div>'); }
    else { html.push(`<p class="my-2">${renderInline(escapeHtml(line))}</p>`); }
  }
  flushList();
  if (inCode) { html.push('</code></pre>'); }
  return html.join('\n');
}

const Markdown: React.FC<MarkdownProps> = ({ text, className }) => {
  const html = React.useMemo(() => renderBlocks(text || ''), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default Markdown;
