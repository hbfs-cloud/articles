/**
 * markdown-to-prosemirror.js — minimal Markdown -> Substack ProseMirror doc.
 *
 * Substack post bodies are ProseMirror JSON, not Markdown. gen-substack-draft.js produces Markdown,
 * so we convert here. Coverage: headings, paragraphs, bullet/ordered lists, blockquote, hr, code
 * fences, tables (pipe), and inline **bold** / *italic* / `code` / [links](url).
 *
 * This is intentionally small and dependency-free. It is NOT a full CommonMark parser — our articles
 * emit a predictable subset (see gen-substack-draft.js). Extend as needed once validated live.
 */
'use strict';

function inlineMarks(text) {
  // Tokenize a line into ProseMirror text nodes with marks. Order: code, link, bold, italic.
  const nodes = [];
  let i = 0;
  const push = (str, marks) => { if (str) nodes.push(marks && marks.length ? { type: 'text', text: str, marks } : { type: 'text', text: str }); };

  // Simple sequential scanner using regex on the remaining string.
  const patterns = [
    { re: /`([^`]+)`/, mark: () => [{ type: 'code' }], text: m => m[1] },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, mark: m => [{ type: 'link', attrs: { href: m[2] } }], text: m => m[1] },
    { re: /\*\*([^*]+)\*\*/, mark: () => [{ type: 'strong' }], text: m => m[1] },
    { re: /(?<!\*)\*([^*]+)\*(?!\*)/, mark: () => [{ type: 'em' }], text: m => m[1] },
  ];

  let rest = text;
  while (rest.length) {
    let best = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { p, m };
    }
    if (!best) { push(rest); break; }
    const { p, m } = best;
    if (m.index > 0) push(rest.slice(0, m.index));
    push(p.text(m), p.mark(m));
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes.length ? nodes : [{ type: 'text', text: text || ' ' }];
}

function tableNode(lines) {
  const parseRow = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  const rows = lines.map(parseRow);
  // rows[1] is the --- separator; drop it.
  const header = rows[0];
  const bodyRows = rows.slice(2);
  const cell = (text, isHeader) => ({
    type: isHeader ? 'table_header' : 'table_cell',
    content: [{ type: 'paragraph', content: inlineMarks(text) }],
  });
  const trs = [];
  trs.push({ type: 'table_row', content: header.map(c => cell(c, true)) });
  for (const r of bodyRows) trs.push({ type: 'table_row', content: r.map(c => cell(c, false)) });
  return { type: 'table', content: trs };
}

export function markdownToProseMirror(md) {
  const content = [];
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  const isTableSep = s => /^\|?\s*:?-{3,}/.test(s);

  while (i < lines.length) {
    let line = lines[i];

    if (!line.trim()) { i++; continue; }

    // hr
    if (/^---+\s*$/.test(line)) { content.push({ type: 'horizontal_rule' }); i++; continue; }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      content.push({ type: 'heading', attrs: { level: h[1].length }, content: inlineMarks(h[2]) });
      i++; continue;
    }

    // code fence
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      content.push({ type: 'code_block', content: [{ type: 'text', text: buf.join('\n') || ' ' }] });
      continue;
    }

    // table (header line followed by --- separator)
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const buf = [line, lines[i + 1]]; i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { buf.push(lines[i]); i++; }
      content.push(tableNode(buf));
      continue;
    }

    // blockquote (possibly multi-line)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inlineMarks(buf.join(' ').trim()) }] });
      continue;
    }

    // lists
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      const items = [];
      const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (!m) break;
        items.push({ type: 'list_item', content: [{ type: 'paragraph', content: inlineMarks(m[1]) }] });
        i++;
      }
      content.push({ type: ordered ? 'ordered_list' : 'bullet_list', content: items });
      continue;
    }

    // paragraph (accumulate until blank line)
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s?|```|---+\s*$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      buf.push(lines[i]); i++;
    }
    content.push({ type: 'paragraph', content: inlineMarks(buf.join(' ')) });
  }

  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** Build a compact ProseMirror-ish body for a Note teaser (plain paragraphs). */
export function noteToProseMirror(text) {
  const paras = String(text || '').split(/\n\n+/).filter(Boolean)
    .map(p => ({ type: 'paragraph', content: inlineMarks(p.replace(/\n/g, ' ')) }));
  return { type: 'doc', content: paras.length ? paras : [{ type: 'paragraph' }] };
}
