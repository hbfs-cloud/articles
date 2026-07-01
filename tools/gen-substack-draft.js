#!/usr/bin/env node
/**
 * gen-substack-draft.js — HTML article → Substack-ready draft converter
 *
 * Converts a published DailyTickers article (daily / weekly / analyses / scanner)
 * into clean Markdown ready to paste or POST to Substack. This tool NEVER publishes
 * anything and never touches the network — pure local file → file conversion.
 *
 * Output object: { title, subtitle, body_markdown, canonical_url, tags, note }
 *
 * Usage:
 *   node tools/gen-substack-draft.js <path>            # prints the draft markdown to stdout
 *   node tools/gen-substack-draft.js <path> --json     # prints the structured object
 *   node tools/gen-substack-draft.js <path> --note     # prints just the Substack Notes teaser
 *   node tools/gen-substack-draft.js <path> --out       # writes data/substack-drafts/<slug>.md + .json
 *
 * Zero dependencies (vanilla node). These are our own templated articles, so
 * regex/string parsing of the predictable structure is sufficient.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://articles.dailytickers.com';
const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------
const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', minus: '−', hellip: '…',
    rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    bull: '•', middot: '·', deg: '°', asymp: '≈',
    times: '×', divide: '÷', plusmn: '±', frac12: '½',
    frac14: '¼', frac34: '¾', trade: '™', reg: '®',
    copy: '©', laquo: '«', raquo: '»',
    eacute: 'é', egrave: 'è', agrave: 'à', ugrave: 'ù', ograve: 'ò',
    ecirc: 'ê', acirc: 'â', ocirc: 'ô', icirc: 'î', ucirc: 'û',
    ccedil: 'ç', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', auml: 'ä', yuml: 'ÿ',
    iacute: 'í', oacute: 'ó', uacute: 'ú', aacute: 'á', ntilde: 'ñ', atilde: 'ã', otilde: 'õ',
    aring: 'å', oslash: 'ø', aelig: 'æ', szlig: 'ß',
    Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', Ocirc: 'Ô', Ntilde: 'Ñ',
    rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔',
    euro: '€', pound: '£', cent: '¢', yen: '¥', sect: '§', para: '¶',
    dagger: '†', Dagger: '‡', permil: '‰', prime: '′', Prime: '″',
    le: '≤', ge: '≥', ne: '≠', infin: '∞', spades: '♠',
    Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ',
    Ecirc: 'Ê', oelig: 'œ', OElig: 'Œ', Ucirc: 'Û', Icirc: 'Î', Acirc: 'Â',
    Eacute2: 'É', sup2: '²', sup3: '³', sup1: '¹', frac13: '⅓', frac23: '⅔'
};

function decodeEntities(str) {
    if (!str) return '';
    return str
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
            Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : m);
}

// Strip every remaining tag and decode entities → plain inline text.
function stripTags(html) {
    if (!html) return '';
    return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Balanced-element removal (handles nested same-name tags)
// ---------------------------------------------------------------------------
// Given the index of a start tag `<tag ...>`, return the index just past its
// matching close tag `</tag>`, accounting for nesting.
function endOfElement(html, tag, startTagOpenIdx) {
    const open = new RegExp('<' + tag + '\\b', 'gi');
    const close = new RegExp('</' + tag + '\\s*>', 'gi');
    // position scanning cursor right after the first '<tag'
    let depth = 0;
    let i = startTagOpenIdx;
    while (i < html.length) {
        open.lastIndex = i;
        close.lastIndex = i;
        const om = open.exec(html);
        const cm = close.exec(html);
        if (!cm) return html.length; // unbalanced — bail to end
        if (om && om.index < cm.index) {
            depth++;
            i = om.index + 1;
        } else {
            depth--;
            i = cm.index + cm[0].length;
            if (depth === 0) return i;
        }
    }
    return html.length;
}

// Remove every element whose opening tag matches `startRe` (which must capture
// the tag name in group 1), including its full balanced content.
function removeElements(html, startRe) {
    let out = html;
    let guard = 0;
    while (guard++ < 500) {
        startRe.lastIndex = 0;
        const m = startRe.exec(out);
        if (!m) break;
        const tag = m[1];
        const end = endOfElement(out, tag, m.index);
        out = out.slice(0, m.index) + out.slice(end);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------
function getAttr(tagText, name) {
    const m = tagText.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i')) ||
              tagText.match(new RegExp(name + "\\s*=\\s*'([^']*)'", 'i'));
    return m ? m[1] : null;
}

function hasClass(tagText, cls) {
    const c = getAttr(tagText, 'class');
    if (!c) return false;
    return c.split(/\s+/).includes(cls);
}

// ---------------------------------------------------------------------------
// Link rewriting → absolute articles.dailytickers.com URLs
// ---------------------------------------------------------------------------
function absolutizeUrl(href, canonical) {
    if (!href) return href;
    href = decodeEntities(href.trim());
    if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
    if (href.startsWith('#')) return canonical + href;        // in-page anchor
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return SITE + href;              // root-relative
    // path-relative (e.g. "archive/20260101/") — resolve against canonical dir
    return canonical.replace(/\/$/, '') + '/' + href.replace(/^\.\//, '');
}

// ---------------------------------------------------------------------------
// Table → markdown
// ---------------------------------------------------------------------------
function convertTable(tableHtml, canonical) {
    const rows = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr;
    while ((tr = trRe.exec(tableHtml))) {
        const cells = [];
        const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let c;
        while ((c = cellRe.exec(tr[1]))) {
            cells.push(inlineToMd(c[2], canonical) || ' ');
        }
        if (cells.length) rows.push(cells);
    }
    if (!rows.length) return '';
    const width = Math.max(...rows.map(r => r.length));
    const pad = r => { while (r.length < width) r.push(' '); return r; };
    const header = pad(rows[0].slice());
    const bodyRows = rows.slice(1).map(r => pad(r.slice()));
    let md = '| ' + header.join(' | ') + ' |\n';
    md += '| ' + header.map(() => '---').join(' | ') + ' |\n';
    for (const r of bodyRows) md += '| ' + r.join(' | ') + ' |\n';
    return md;
}

// ---------------------------------------------------------------------------
// Inline HTML → markdown (bold, italic, links, code). Strips icons/images.
// ---------------------------------------------------------------------------
function inlineToMd(html, canonical) {
    if (!html) return '';
    let s = html;
    s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<i\b[^>]*><\/i>/gi, '');               // FA icon (empty)
    s = s.replace(/<i\b[^>]*class="fa[^"]*"[^>]*>[\s\S]*?<\/i>/gi, ''); // FA icon
    s = s.replace(/<img\b[^>]*>/gi, '');
    s = s.replace(/<br\s*\/?>/gi, ' ');
    s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, text) => {
        const href = absolutizeUrl(getAttr(attrs, 'href'), canonical);
        const label = stripTags(text);
        if (!label) return '';
        if (!href) return label;
        return `[${label}](${href})`;
    });
    s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, inner) => {
        const txt = inlineToMd(inner, canonical).trim();
        return txt ? `**${txt}**` : '';
    });
    s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, t, inner) => {
        const txt = inlineToMd(inner, canonical).trim();
        return txt ? `*${txt}*` : '';
    });
    s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (m, inner) => '`' + stripTags(inner) + '`');
    s = s.replace(/<[^>]+>/g, '');                          // drop any leftover tags
    s = decodeEntities(s);
    s = s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, ' ').trim();
    return s;
}

// ---------------------------------------------------------------------------
// Extract ECharts captions so chart containers become meaningful placeholders
// ---------------------------------------------------------------------------
function extractChartCaptions(bodyHtml) {
    const map = {};
    // Tie each chart id to the title.text within the SAME echarts.init block
    // (tempered so we never cross into the next init call).
    const re = /echarts\.init\(\s*document\.getElementById\(['"]([^'"]+)['"]\)\s*\)((?:(?!echarts\.init)[\s\S])*?)title\s*:\s*\{[^}]*?text\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(bodyHtml))) {
        if (m[3] && !map[m[1]]) map[m[1]] = m[3];
    }
    return map;
}

// ---------------------------------------------------------------------------
// Block-level walker: cleaned HTML → markdown
// ---------------------------------------------------------------------------
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'button', 'select', 'option', 'nav', 'footer', 'iframe', 'form']);

function walk(html, canonical, tokens) {
    // Tokenize into tags / text
    const parts = [];
    const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g;
    let last = 0;
    let m;
    while ((m = tagRe.exec(html))) {
        if (m.index > last) parts.push({ type: 'text', raw: html.slice(last, m.index) });
        last = m.index + m[0].length;
        if (m[0].startsWith('<!--')) continue;
        const name = m[1].toLowerCase();
        const isClose = m[0].startsWith('</');
        const selfClose = m[0].endsWith('/>') || VOID_TAGS.has(name);
        parts.push({
            type: isClose ? 'close' : (selfClose ? 'void' : 'open'),
            tag: name, attrs: m[2] || '', raw: m[0]
        });
    }
    if (last < html.length) parts.push({ type: 'text', raw: html.slice(last) });

    let out = '';
    const stack = [];           // element context stack
    let bqDepth = 0;            // blockquote nesting (takeaway / alert / thesis)
    const listStack = [];      // { type:'ul'|'ol', n:count }
    let inlineBuf = '';
    let skipDepth = 0;         // inside a fully-skipped element

    const HEADING = { h1: '# ', h2: '## ', h3: '### ', h4: '#### ', h5: '##### ', h6: '###### ' };
    const BQ_CLASSES = ['takeaway-box', 'alert-banner', 'alert-box', 'geo-alert', 'pedagogy-box',
        'didactic-box', 'quote-block', 'trade-thesis', 'bias-box', 'takeaway'];

    function prefixLines(text, prefix) {
        return text.split('\n').map(l => prefix + l).join('\n');
    }

    function pushBlock(md) {
        if (!md.trim()) return;
        let block = md;
        if (listStack.length) {
            // rendered inside list item handling instead
        }
        if (bqDepth > 0) block = prefixLines(block, '> ');
        out += (out && !out.endsWith('\n\n') ? '\n\n' : '') + block + '\n\n';
    }

    function flushInline() {
        const md = inlineToMd(inlineBuf, canonical);
        inlineBuf = '';
        if (!md) return;
        if (listStack.length) {
            const lst = listStack[listStack.length - 1];
            const indent = '  '.repeat(listStack.length - 1);
            const marker = lst.type === 'ol' ? `${++lst.n}. ` : '- ';
            let line = indent + marker + md;
            if (bqDepth > 0) line = prefixLines(line, '> ');
            out += line + '\n';
        } else {
            pushBlock(md);
        }
    }

    for (const p of parts) {
        if (skipDepth > 0) {
            if (p.type === 'open' && SKIP_TAGS.has(p.tag)) skipDepth++;
            else if (p.type === 'close' && SKIP_TAGS.has(p.tag)) skipDepth--;
            continue;
        }
        if (p.type === 'text') {
            inlineBuf += p.raw;
            continue;
        }
        if (p.type === 'void') {
            if (p.tag === 'br') inlineBuf += ' ';
            if (p.tag === 'hr') { flushInline(); pushBlock('---'); }
            // images / icons ignored
            continue;
        }
        if (p.type === 'open') {
            if (SKIP_TAGS.has(p.tag)) { flushInline(); skipDepth = 1; continue; }
            if (HEADING[p.tag]) {
                flushInline();
                stack.push({ tag: p.tag, heading: true });
                continue;
            }
            if (p.tag === 'ul' || p.tag === 'ol') {
                flushInline();
                listStack.push({ type: p.tag, n: 0 });
                stack.push({ tag: p.tag });
                continue;
            }
            if (p.tag === 'li') {
                flushInline();
                stack.push({ tag: 'li' });
                continue;
            }
            if (p.tag === 'blockquote') {
                flushInline();
                bqDepth++;
                stack.push({ tag: p.tag, bq: true });
                continue;
            }
            if (p.tag === 'div' || p.tag === 'section' || p.tag === 'article' || p.tag === 'aside' || p.tag === 'header') {
                flushInline();
                const isBq = BQ_CLASSES.some(c => hasClass(p.attrs, c));
                if (isBq) bqDepth++;
                stack.push({ tag: p.tag, bq: isBq });
                continue;
            }
            if (p.tag === 'p') {
                flushInline();
                stack.push({ tag: 'p' });
                continue;
            }
            // inline tags (strong/em/a/span/code...) — keep raw for inlineToMd
            inlineBuf += p.raw;
            stack.push({ tag: p.tag, inline: true });
            continue;
        }
        if (p.type === 'close') {
            // find matching context on stack
            const ctx = stack.length ? stack[stack.length - 1] : null;
            if (ctx && ctx.inline) {
                inlineBuf += p.raw;
                stack.pop();
                continue;
            }
            if (HEADING[p.tag]) {
                const md = inlineToMd(inlineBuf, canonical);
                inlineBuf = '';
                if (md) pushBlock((HEADING[p.tag]) + md);
                if (ctx) stack.pop();
                continue;
            }
            if (p.tag === 'ul' || p.tag === 'ol') {
                flushInline();
                listStack.pop();
                if (ctx) stack.pop();
                if (!listStack.length) out += '\n';
                continue;
            }
            if (p.tag === 'li') {
                flushInline();
                if (ctx) stack.pop();
                continue;
            }
            if (p.tag === 'p') {
                flushInline();
                if (ctx) stack.pop();
                continue;
            }
            if (p.tag === 'blockquote' || ['div', 'section', 'article', 'aside', 'header'].includes(p.tag)) {
                flushInline();
                if (ctx && ctx.bq && bqDepth > 0) bqDepth--;
                if (ctx) stack.pop();
                continue;
            }
            // stray close
            continue;
        }
    }
    flushInline();
    return out;
}

// ---------------------------------------------------------------------------
// Element mapping by exact class token (balanced, non-spanning)
// ---------------------------------------------------------------------------
// Replace every element whose opening tag carries the exact class token `cls`
// with fn(innerHtml, openTag). Balanced so it never over-spans into siblings.
function classTokenPattern(cls) {
    return 'class="(?:[^"]*\\s)?' + cls.replace(/[-]/g, '\\-') + '(?:\\s[^"]*)?"';
}
function mapElementsByClass(html, cls, fn) {
    const startRe = new RegExp('<([a-zA-Z][\\w-]*)\\b[^>]*' + classTokenPattern(cls) + '[^>]*>', 'gi');
    let out = '';
    let idx = 0;
    let guard = 0;
    while (guard++ < 2000) {
        startRe.lastIndex = idx;
        const m = startRe.exec(html);
        if (!m) { out += html.slice(idx); break; }
        const tag = m[1];
        const openEnd = m.index + m[0].length;
        const elemEnd = endOfElement(html, tag, m.index);
        let inner = html.slice(openEnd, elemEnd).replace(new RegExp('</' + tag + '\\s*>\\s*$', 'i'), '');
        out += html.slice(idx, m.index) + fn(inner, m[0]);
        idx = elemEnd;
    }
    return out;
}

// Build a small markdown table from parallel header/value arrays.
function twoRowTable(headers, values, tokens) {
    if (!headers.length) return '';
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    md += '| ' + values.join(' | ') + ' |\n';
    const id = tokens.push(md.trim()) - 1;
    return `\n\n[[TOKEN${id}]]\n\n`;
}

// ---------------------------------------------------------------------------
// Pre-process known card grids → clean markdown tables (scoped to containers)
// ---------------------------------------------------------------------------
function convertGrids(html, canonical, tokens) {
    // trade-idea / daily .levels → 2-row (label → value) table
    html = mapElementsByClass(html, 'levels', inner => {
        const pairRe = new RegExp(
            '<div\\b[^>]*' + classTokenPattern('label') + '[^>]*>([\\s\\S]*?)<\\/div>\\s*' +
            '<div\\b[^>]*' + classTokenPattern('val') + '[^>]*>([\\s\\S]*?)<\\/div>', 'gi');
        const headers = [], values = [];
        let m;
        while ((m = pairRe.exec(inner))) {
            headers.push(inlineToMd(m[1], canonical) || ' ');
            values.push(inlineToMd(m[2], canonical) || ' ');
        }
        return headers.length ? twoRowTable(headers, values, tokens) : '';
    });

    const grabIn = (inner, cls) => {
        const re = new RegExp('<div\\b[^>]*' + classTokenPattern(cls) + '[^>]*>([\\s\\S]*?)<\\/div>', 'gi');
        const arr = []; let m;
        while ((m = re.exec(inner))) arr.push(inlineToMd(m[1], canonical));
        return arr;
    };
    const metricTable = (labels, values, changes) => {
        if (!labels.length) return '';
        const hasChange = changes.some(Boolean);
        let md = hasChange ? '| Metric | Value | Change |\n| --- | --- | --- |\n'
                           : '| Metric | Value |\n| --- | --- |\n';
        for (let i = 0; i < labels.length; i++) {
            md += hasChange
                ? `| ${labels[i] || ' '} | ${values[i] || ' '} | ${changes[i] || ' '} |\n`
                : `| ${labels[i] || ' '} | ${values[i] || ' '} |\n`;
        }
        const id = tokens.push(md.trim()) - 1;
        return `\n\n[[TOKEN${id}]]\n\n`;
    };

    // daily .dashboard-grid → Metric | Value | Change table
    html = mapElementsByClass(html, 'dashboard-grid', inner =>
        metricTable(grabIn(inner, 'dash-card-label'), grabIn(inner, 'dash-card-value'), grabIn(inner, 'dash-card-change')));

    // analyses .metric-grid → Metric | Value | Change table
    html = mapElementsByClass(html, 'metric-grid', inner =>
        metricTable(grabIn(inner, 'metric-label'), grabIn(inner, 'metric-value'), grabIn(inner, 'metric-change')));

    return html;
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------
function firstMatch(html, re) {
    const m = html.match(re);
    return m ? m[1] : null;
}

function extractMeta(html, tab) {
    const htmlTag = firstMatch(html, /<html\b([^>]*)>/i) || '';
    const lang = getAttr(htmlTag, 'lang') || 'en';
    const dataTags = getAttr(htmlTag, 'data-tags') || '';
    const grade = getAttr(htmlTag, 'data-grade') || null;
    const rawTitle = stripTags(firstMatch(html, /<title>([\s\S]*?)<\/title>/i) || '');
    const tags = dataTags.split(',').map(t => t.trim()).filter(Boolean);

    let title = null, subtitle = null;

    if (tab === 'analyses') {
        const sym = stripTags(firstMatch(html, /<div class="ticker-symbol"[^>]*>([\s\S]*?)<\/div>/i) || '');
        const name = stripTags(firstMatch(html, /<div class="ticker-name"[^>]*>([\s\S]*?)<\/div>/i) || '');
        const company = name.split(/—|–| - | • /)[0].trim();
        if (sym) title = company ? `${sym} — ${company}` : sym;
        const scoreLabel = stripTags(firstMatch(html, /<div class="score-label"[^>]*>([\s\S]*?)<\/div>/i) || '');
        subtitle = scoreLabel || name || null;
    } else {
        // daily / weekly / scanner: h1.hero-title or first h1 within hero
        title = stripTags(firstMatch(html, /<h1[^>]*class="[^"]*hero-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || '');
        if (!title) {
            const heroBlock = firstMatch(html, /class="hero-section"[\s\S]*?(<h1[\s\S]*?<\/h1>)/i);
            title = stripTags(heroBlock || firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || '');
        }
        subtitle = stripTags(firstMatch(html, /<p[^>]*class="[^"]*hero-subtitle[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || '');
        if (!subtitle) {
            // first <p> inside the hero-section
            const heroInner = firstMatch(html, /class="hero-section"([\s\S]*?)<\/section>|class="hero-section"([\s\S]*?)<div class="fnav"/i);
            const hp = heroInner ? firstMatch(heroInner, /<p[^>]*>([\s\S]*?)<\/p>/i) : null;
            subtitle = stripTags(hp || '');
        }
    }

    if (!title) title = rawTitle.split('|')[0].trim();
    // Clean common "| DailyTickers" style suffixes from fallback titles
    title = title.replace(/\s*\|\s*DailyTickers.*$/i, '').trim();

    return { lang, tags, grade, title, subtitle: subtitle || '' };
}

// ---------------------------------------------------------------------------
// Canonical URL + slug from file path
// ---------------------------------------------------------------------------
function canonicalFromPath(absPath) {
    let rel = path.relative(REPO_ROOT, absPath).split(path.sep).join('/');
    rel = rel.replace(/index\.html?$/i, '');
    if (!rel.endsWith('/')) rel += '/';
    return SITE + '/' + rel.replace(/^\/+/, '');
}

function slugFromPath(absPath) {
    let rel = path.relative(REPO_ROOT, absPath).split(path.sep).join('/');
    rel = rel.replace(/\/?index\.html?$/i, '').replace(/\/+$/, '');
    return rel.replace(/[\/]+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '') || 'draft';
}

// ---------------------------------------------------------------------------
// Notes teaser (<=280 chars, plain text + canonical link)
// ---------------------------------------------------------------------------
function buildNote(meta, canonical) {
    const LIMIT = 280;
    const link = canonical;
    const title = meta.title;
    // budget for the hook = 280 - title - link - separators (2x "\n\n")
    let base = title + '\n\n';
    const tail = '\n\n' + link;
    let budget = LIMIT - base.length - tail.length;
    let hook = meta.subtitle || '';
    if (budget < 0) {
        // title alone too long; truncate title
        const t = title.slice(0, LIMIT - tail.length - 1).replace(/\s+\S*$/, '') + '…';
        return t + tail;
    }
    if (hook.length > budget) {
        hook = hook.slice(0, Math.max(0, budget - 1)).replace(/\s+\S*$/, '').trim() + '…';
    }
    return (hook ? base + hook : title) + tail;
}

// ---------------------------------------------------------------------------
// Body footer (back-link + subscribe CTA)
// ---------------------------------------------------------------------------
function bodyFooter(canonical) {
    return [
        '---',
        '',
        `📈 **Read the full analysis — with live charts, data tables, and interactive visuals:** [${canonical}](${canonical})`,
        '',
        '*Subscribe to DailyTickers for daily market briefings, weekly reviews, and institutional-grade ticker analyses.*'
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------
function convert(absPath) {
    const html = fs.readFileSync(absPath, 'utf8');
    const htmlTag = firstMatch(html, /<html\b([^>]*)>/i) || '';
    const tab = getAttr(htmlTag, 'data-tab') || 'daily';
    const canonical = canonicalFromPath(absPath);
    const meta = extractMeta(html, tab);

    // Isolate <body>
    let body = firstMatch(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i) || html;

    // Chart captions BEFORE stripping scripts
    const captions = extractChartCaptions(body);

    // Strip scripts / styles / noscript (do not nest)
    body = body.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    body = body.replace(/<style\b[\s\S]*?<\/style>/gi, '');
    body = body.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');

    // Replace ECharts / chart containers with placeholder tokens
    const tokens = [];
    body = body.replace(/<div\b([^>]*)>\s*<\/div>/gi, (m, attrs, offset, full) => {
        const id = getAttr(attrs, 'id');
        const isChart = hasClass(attrs, 'echart-box') || hasClass(attrs, 'echart') ||
            hasClass(attrs, 'chart-container') || (id && captions[id]) || (id && /chart/i.test(id));
        if (isChart) {
            let cap = (id && captions[id]) ? captions[id] : null;
            if (!cap) {
                const before = full.slice(0, offset);
                const hRe = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
                let hm, lastText = null;
                while ((hm = hRe.exec(before))) lastText = hm[1];
                if (lastText) cap = stripTags(lastText);
            }
            const label = cap ? `Chart: ${cap}` : 'Chart';
            const tid = tokens.push(`> 📊 **[${label}]** — view the interactive version in the full article.`) - 1;
            return `\n\n[[TOKEN${tid}]]\n\n`;
        }
        return ''; // empty structural div
    });

    // Remove chrome: brand-bar, hero (already used), FAB, footer, modals, switchers
    body = removeElements(body, /<(nav)\b[^>]*class="[^"]*\bbrand-bar\b[^"]*"[^>]*>/i);
    body = removeElements(body, /<(section|div)\b[^>]*class="[^"]*\bhero-section\b[^"]*"[^>]*>/i);
    body = removeElements(body, /<(div|header)\b[^>]*class="[^"]*\bticker-header\b[^"]*"[^>]*>/i);
    body = removeElements(body, /<(div)\b[^>]*class="[^"]*\bfnav\b[^"]*"[^>]*>/i);
    body = removeElements(body, /<(footer)\b[^>]*>/i);
    body = removeElements(body, /<(div)\b[^>]*id="[^"]*[Mm]odal[^"]*"[^>]*>/i);
    body = removeElements(body, /<(div)\b[^>]*class="[^"]*\b(modal|lang-switcher|variant-switcher|switcher-bar)\b[^"]*"[^>]*>/i);

    // Special card grids → clean tables (trade-idea levels, dashboard)
    body = convertGrids(body, canonical, tokens);

    // Tables → markdown tokens
    body = body.replace(/<table\b[\s\S]*?<\/table>/gi, tbl => {
        const md = convertTable(tbl, canonical);
        if (!md) return '';
        const id = tokens.push(md.trim()) - 1;
        return `\n\n[[TOKEN${id}]]\n\n`;
    });

    // Walk remaining HTML → markdown
    let md = walk(body, canonical, tokens);

    // Reinsert tokens
    md = md.replace(/\[\[TOKEN(\d+)\]\]/g, (m, i) => tokens[+i] || '');

    // Cleanup: collapse blank lines, trim, fix stray blockquote artifacts
    md = md.replace(/\n{3,}/g, '\n\n')
           .replace(/^(>\s*)+$/gm, '')
           .replace(/[ \t]+$/gm, '')
           .trim();

    const body_markdown = md + '\n\n' + bodyFooter(canonical);
    const note = buildNote(meta, canonical);

    return {
        title: meta.title,
        subtitle: meta.subtitle,
        body_markdown,
        canonical_url: canonical,
        tags: meta.tags,
        note,
        _tab: tab
    };
}

// Full pasteable markdown draft (title + subtitle + body)
function renderDraftMarkdown(draft) {
    let out = `# ${draft.title}\n\n`;
    if (draft.subtitle) out += `*${draft.subtitle}*\n\n`;
    out += draft.body_markdown + '\n';
    return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter(a => a.startsWith('--')));
    const inputArg = args.find(a => !a.startsWith('--'));
    if (!inputArg) {
        console.error('Usage: node tools/gen-substack-draft.js <path/to/article> [--json] [--note] [--out]');
        process.exit(1);
    }
    let absPath = path.resolve(process.cwd(), inputArg);
    if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
        absPath = path.join(absPath, 'index.html');
    }
    if (!fs.existsSync(absPath)) {
        console.error('File not found: ' + absPath);
        process.exit(1);
    }

    const draft = convert(absPath);
    const publicDraft = {
        title: draft.title,
        subtitle: draft.subtitle,
        body_markdown: draft.body_markdown,
        canonical_url: draft.canonical_url,
        tags: draft.tags,
        note: draft.note
    };

    if (flags.has('--note')) {
        console.log(draft.note);
        return;
    }

    if (flags.has('--out')) {
        const outDir = path.join(REPO_ROOT, 'data', 'substack-drafts');
        fs.mkdirSync(outDir, { recursive: true });
        const slug = slugFromPath(absPath);
        const mdPath = path.join(outDir, slug + '.md');
        const jsonPath = path.join(outDir, slug + '.json');
        fs.writeFileSync(mdPath, renderDraftMarkdown(draft), 'utf8');
        fs.writeFileSync(jsonPath, JSON.stringify(publicDraft, null, 2), 'utf8');
        console.error('Wrote ' + path.relative(REPO_ROOT, mdPath));
        console.error('Wrote ' + path.relative(REPO_ROOT, jsonPath));
    }

    if (flags.has('--json')) {
        console.log(JSON.stringify(publicDraft, null, 2));
    } else if (!flags.has('--out')) {
        console.log(renderDraftMarkdown(draft));
    }
}

if (require.main === module) main();

module.exports = { convert, renderDraftMarkdown };
