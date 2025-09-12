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
  let out = md.replace(/`([^`]+)`/g, (_m, p1) => `<code>${escapeHtml(p1)}</code>`);
  // links
  out = out.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, (_m, label, url) => {
    const safeUrl = escapeHtml(url);
    const safeLabel = escapeHtml(label);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer" class="underline">${safeLabel}</a>`;
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
        html.push(`<pre class="bg-muted/30 border border-border rounded p-2 overflow-auto"><code>`);
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
      html.push(`<h${lvl} class="font-semibold mt-2">${renderInline(escapeHtml(m[2]))}</h${lvl}>`);
      continue;
    }

    // paragraph or blank
    if (line.trim().length === 0) { html.push('<br/>'); }
    else { html.push(`<p>${renderInline(escapeHtml(line))}</p>`); }
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

