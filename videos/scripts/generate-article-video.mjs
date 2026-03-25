#!/usr/bin/env node
/**
 * generate-article-video.mjs — Convert an existing HTML article into video slides JSON
 *
 * Usage: node scripts/generate-article-video.mjs <series-id> <article-path>
 *
 * Example:
 *   node scripts/generate-article-video.mjs claude-code-avance /path/to/articles/tech/claude-code-avance/index.html
 *
 * Outputs:
 *   public/edu-data.json       — slides + config (consumed by Remotion)
 *   public/edu-narration.json  — narration text segments (consumed by TTS)
 */
import fs from 'fs-extra';
import path from 'path';
import { JSDOM } from 'jsdom';

// ── Args ─────────────────────────────────────────────────────────────

const seriesId = process.argv[2];
const articlePath = process.argv[3];

if (!seriesId || !articlePath) {
  console.error('Usage: node scripts/generate-article-video.mjs <series-id> <article-path>');
  console.error('Example: node scripts/generate-article-video.mjs claude-code-avance /path/to/tech/claude-code-avance/index.html');
  process.exit(1);
}

if (!fs.existsSync(articlePath)) {
  console.error(`File not found: ${articlePath}`);
  process.exit(1);
}

// ── Slide builder ────────────────────────────────────────────────────

let slideIndex = 0;
const audioPrefix = seriesId.replace(/-/g, '_');

function makeSlide(slide) {
  const audioFile = `${audioPrefix}_s${slideIndex}.wav`;
  slideIndex++;
  return { ...slide, audioFile };
}

// ── Text helpers ─────────────────────────────────────────────────────

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')         // strip HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'e')
    .replace(/&egrave;/g, 'e')
    .replace(/&agrave;/g, 'a')
    .replace(/&ecirc;/g, 'e')
    .replace(/&ocirc;/g, 'o')
    .replace(/&ccedil;/g, 'c')
    .replace(/&[a-z]+;/g, '')        // remaining entities
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = 500) {
  if (!text || text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return text.substring(0, cut > 0 ? cut : max) + '...';
}

function getInnerText(el) {
  if (!el) return '';
  return cleanText(el.textContent || '');
}

// ── HTML parsing ─────────────────────────────────────────────────────

function parseArticle(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Extract metadata
  const lang = doc.documentElement.getAttribute('lang') || 'fr';
  const titleEl = doc.querySelector('h1') || doc.querySelector('title');
  const title = getInnerText(titleEl);

  // Subtitle from hero description or meta
  const heroP = doc.querySelector('.hero-section p, header p');
  const metaDesc = doc.querySelector('meta[name="description"]');
  const subtitle = getInnerText(heroP) || (metaDesc ? metaDesc.getAttribute('content') : '') || '';

  // Detect accent color from hero or default
  const heroDate = doc.querySelector('.hero-date');
  let accentColor = '#3b82f6';
  if (heroDate) {
    const style = heroDate.getAttribute('style') || '';
    const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6})/);
    if (colorMatch) accentColor = colorMatch[1];
  }

  // Parse sections — find all content-card divs or fall back to h2 splitting
  const sections = [];
  const contentCards = doc.querySelectorAll('.content-card');

  if (contentCards.length > 0) {
    contentCards.forEach(card => {
      const h2 = card.querySelector('h2');
      const sectionTitle = getInnerText(h2) || '';
      sections.push({ title: sectionTitle, element: card });
    });
  } else {
    // Fallback: split by h2 headings
    const body = doc.querySelector('body');
    if (body) {
      const h2s = body.querySelectorAll('h2');
      if (h2s.length > 0) {
        h2s.forEach(h2 => {
          const sectionTitle = getInnerText(h2);
          // Collect all siblings until next h2
          const container = doc.createElement('div');
          let sibling = h2.nextElementSibling;
          container.appendChild(h2.cloneNode(true));
          while (sibling && sibling.tagName !== 'H2') {
            container.appendChild(sibling.cloneNode(true));
            sibling = sibling.nextElementSibling;
          }
          sections.push({ title: sectionTitle, element: container });
        });
      } else {
        // Last resort: treat the whole body as one section
        sections.push({ title: title, element: body });
      }
    }
  }

  return { title, subtitle, lang, accentColor, sections };
}

// ── Section → Slides conversion ──────────────────────────────────────

function extractSlidesFromSection(section, chapterNum, totalChapters) {
  const slides = [];
  const el = section.element;

  // Chapter intro
  slides.push(makeSlide({
    type: 'chapter-intro',
    chapter: {
      title: section.title || `Chapitre ${chapterNum}`,
      subtitle: '',
      partNumber: chapterNum,
      totalParts: totalChapters,
    },
  }));

  // Walk through child elements
  const children = el.children;
  const paragraphBuffer = [];
  let contentSlidesSinceQuiz = 0;

  function flushParagraphs() {
    if (paragraphBuffer.length === 0) return;
    const text = truncate(paragraphBuffer.join('\n\n'), 500);
    if (text.length > 10) {
      slides.push(makeSlide({ type: 'concept', title: section.title, text }));
      contentSlidesSinceQuiz++;
    }
    paragraphBuffer.length = 0;
  }

  function maybeInsertQuiz() {
    if (contentSlidesSinceQuiz >= 8) {
      contentSlidesSinceQuiz = 0;
      return true;
    }
    return false;
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tag = child.tagName;
    const classList = child.classList || { contains: () => false };

    // Skip headings that are the section title (h2)
    if (tag === 'H2') continue;

    // ── Metric cards / dash cards ──
    if (classList.contains('metric-grid') || classList.contains('dash-grid') || classList.contains('metric-row')) {
      flushParagraphs();
      const cards = child.querySelectorAll('.metric-card, .dash-card');
      if (cards.length > 0) {
        const items = [];
        cards.forEach(card => {
          const value = getInnerText(card.querySelector('.metric-value, .dash-value'));
          const label = getInnerText(card.querySelector('.metric-label, .dash-label'));
          if (value && label) items.push(`${label} : ${value}`);
        });
        if (items.length > 0) {
          slides.push(makeSlide({ type: 'bullets', title: section.title + ' — Chiffres clés', items }));
          contentSlidesSinceQuiz++;
        }
      }
      if (maybeInsertQuiz()) quizPlaceholders.push(slides.length);
      continue;
    }

    // ── Didactic box / pedagogy box ──
    if (classList.contains('didactic-box') || classList.contains('pedagogy-box')) {
      flushParagraphs();
      const text = truncate(getInnerText(child), 500);
      if (text.length > 10) {
        slides.push(makeSlide({ type: 'tip', text }));
        contentSlidesSinceQuiz++;
      }
      continue;
    }

    // ── Risk alert / warning ──
    if (classList.contains('risk-alert') || classList.contains('alert-box') || classList.contains('warning-box')) {
      flushParagraphs();
      const alertTitle = getInnerText(child.querySelector('strong, h4, .alert-title')) || 'Attention';
      const text = truncate(getInnerText(child), 500);
      slides.push(makeSlide({ type: 'warning', title: alertTitle, text }));
      contentSlidesSinceQuiz++;
      continue;
    }

    // ── Quote block ──
    if (classList.contains('quote-block') || tag === 'BLOCKQUOTE') {
      flushParagraphs();
      const quoteText = getInnerText(child.querySelector('.quote-text, p') || child);
      const source = getInnerText(child.querySelector('.quote-source, cite, footer')) || '';
      if (quoteText.length > 5) {
        slides.push(makeSlide({ type: 'quote', text: truncate(quoteText, 300), source }));
        contentSlidesSinceQuiz++;
      }
      continue;
    }

    // ── Trade box ──
    if (classList.contains('trade-box')) {
      flushParagraphs();
      const text = truncate(getInnerText(child), 500);
      if (text.length > 10) {
        slides.push(makeSlide({ type: 'tip', title: 'Trade Setup', text }));
        contentSlidesSinceQuiz++;
      }
      continue;
    }

    // ── Tables ──
    if (tag === 'TABLE' || child.querySelector('table')) {
      flushParagraphs();
      const table = tag === 'TABLE' ? child : child.querySelector('table');
      const hasThead = !!table.querySelector('thead');
      const headers = [];
      let headerRowCount = 0;

      if (hasThead) {
        table.querySelectorAll('thead th, thead td').forEach(th => headers.push(getInnerText(th)));
      } else {
        // Use first row as header if it contains <th> elements
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          const ths = firstRow.querySelectorAll('th');
          if (ths.length > 0) {
            ths.forEach(th => headers.push(getInnerText(th)));
            headerRowCount = 1;
          } else {
            // Use first row's <td> as headers
            firstRow.querySelectorAll('td').forEach(td => headers.push(getInnerText(td)));
            headerRowCount = 1;
          }
        }
      }

      const rows = [];
      const allRows = hasThead ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr');
      allRows.forEach((tr, idx) => {
        if (!hasThead && idx < headerRowCount) return; // skip header row
        const cells = [];
        tr.querySelectorAll('td, th').forEach(td => cells.push(truncate(getInnerText(td), 80)));
        if (cells.length > 0 && cells.some(c => c.length > 0)) rows.push(cells);
      });

      if (headers.length > 0 && rows.length > 0) {
        // Split large tables (max 6 rows per slide)
        for (let r = 0; r < rows.length; r += 6) {
          const chunk = rows.slice(r, r + 6);
          const suffix = rows.length > 6 ? ` (${r / 6 + 1}/${Math.ceil(rows.length / 6)})` : '';
          slides.push(makeSlide({
            type: 'table',
            title: (section.title || 'Tableau') + suffix,
            headers,
            rows: chunk,
          }));
          contentSlidesSinceQuiz++;
        }
      }
      continue;
    }

    // ── Ordered lists (steps) ──
    if (tag === 'OL') {
      flushParagraphs();
      const lis = child.querySelectorAll('li');
      const stepsArr = [];
      lis.forEach((li, idx) => {
        const text = getInnerText(li);
        const parts = text.split(/[.:\-—](.+)/);
        stepsArr.push({
          number: idx + 1,
          title: truncate(parts[0], 80),
          description: truncate(parts[1] || '', 200),
        });
      });
      if (stepsArr.length > 0) {
        slides.push(makeSlide({ type: 'steps', title: section.title, steps: stepsArr }));
        contentSlidesSinceQuiz++;
      }
      continue;
    }

    // ── Unordered lists ──
    if (tag === 'UL') {
      flushParagraphs();
      const lis = child.querySelectorAll('li');
      const items = [];
      lis.forEach(li => {
        const text = truncate(getInnerText(li), 150);
        if (text.length > 3) items.push(text);
      });
      if (items.length > 0) {
        // Split large bullet lists (max 6 per slide)
        for (let b = 0; b < items.length; b += 6) {
          const chunk = items.slice(b, b + 6);
          slides.push(makeSlide({ type: 'bullets', title: section.title, items: chunk }));
          contentSlidesSinceQuiz++;
        }
      }
      continue;
    }

    // ── H3 sub-headings ──
    if (tag === 'H3') {
      flushParagraphs();
      // Use as a mini title for the next concept slides
      const h3Title = getInnerText(child);
      // Peek ahead: if next sibling is a paragraph, combine
      const next = children[i + 1];
      if (next && (next.tagName === 'P' || next.classList?.contains('didactic-box'))) {
        const text = truncate(getInnerText(next), 500);
        if (text.length > 10) {
          slides.push(makeSlide({ type: 'concept', title: h3Title, text }));
          contentSlidesSinceQuiz++;
          i++; // skip the consumed element
        }
      }
      continue;
    }

    // ── H4 sub-headings ──
    if (tag === 'H4') {
      flushParagraphs();
      const h4Title = getInnerText(child);
      const next = children[i + 1];
      if (next && next.tagName === 'P') {
        const text = truncate(getInnerText(next), 500);
        if (text.length > 10) {
          slides.push(makeSlide({ type: 'concept', title: h4Title, text }));
          contentSlidesSinceQuiz++;
          i++;
        }
      }
      continue;
    }

    // ── Code blocks ──
    if (tag === 'PRE' || (child.querySelector && child.querySelector('pre'))) {
      flushParagraphs();
      const pre = tag === 'PRE' ? child : child.querySelector('pre');
      const code = getInnerText(pre);
      // Find preceding label if any
      const prevSib = children[i - 1];
      const label = prevSib && prevSib.classList?.contains('code-label') ? getInnerText(prevSib) : '';
      const codeTitle = label || 'Exemple de code';
      slides.push(makeSlide({
        type: 'concept',
        title: codeTitle,
        text: truncate(code, 500),
      }));
      contentSlidesSinceQuiz++;
      continue;
    }

    // ── Paragraphs ──
    if (tag === 'P') {
      const text = getInnerText(child);
      if (text.length < 10) continue;
      paragraphBuffer.push(text);
      // Flush every 2-3 paragraphs
      if (paragraphBuffer.length >= 3) {
        flushParagraphs();
        if (maybeInsertQuiz()) quizPlaceholders.push(slides.length);
      }
      continue;
    }

    // ── Divs with nested content (section-divider, generic wrappers) ──
    if (tag === 'DIV' && !classList.contains('fnav') && !classList.contains('brand-bar') && !classList.contains('card-tags')) {
      // Check for nested lists, tables, etc.
      const nestedTable = child.querySelector('table');
      const nestedUl = child.querySelector('ul');
      const nestedOl = child.querySelector('ol');

      if (nestedTable || nestedUl || nestedOl) {
        // Re-process by recursing into this div's children
        const innerSection = { title: section.title, element: child };
        const innerSlides = extractContentSlides(child, section.title);
        slides.push(...innerSlides);
        contentSlidesSinceQuiz += innerSlides.length;
      } else {
        // Treat as paragraph
        const text = getInnerText(child);
        if (text.length > 20) {
          paragraphBuffer.push(text);
          if (paragraphBuffer.length >= 3) {
            flushParagraphs();
          }
        }
      }
      continue;
    }
  }

  // Flush remaining paragraphs
  flushParagraphs();

  return slides;
}

// Helper: extract content slides from a nested element (no chapter-intro)
function extractContentSlides(el, sectionTitle) {
  const results = [];
  const children = el.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tag = child.tagName;

    if (tag === 'TABLE' || child.querySelector?.('table')) {
      const table = tag === 'TABLE' ? child : child.querySelector('table');
      const hasThead = !!table.querySelector('thead');
      const headers = [];
      let headerRowCount = 0;
      if (hasThead) {
        table.querySelectorAll('thead th, thead td').forEach(th => headers.push(getInnerText(th)));
      } else {
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          const ths = firstRow.querySelectorAll('th');
          (ths.length > 0 ? ths : firstRow.querySelectorAll('td')).forEach(c => headers.push(getInnerText(c)));
          headerRowCount = 1;
        }
      }
      const rows = [];
      (hasThead ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr')).forEach((tr, idx) => {
        if (!hasThead && idx < headerRowCount) return;
        const cells = [];
        tr.querySelectorAll('td, th').forEach(td => cells.push(truncate(getInnerText(td), 80)));
        if (cells.length > 0 && cells.some(c => c.length > 0)) rows.push(cells);
      });
      if (headers.length > 0 && rows.length > 0) {
        results.push(makeSlide({ type: 'table', title: sectionTitle, headers, rows: rows.slice(0, 6) }));
      }
    } else if (tag === 'UL') {
      const items = [];
      child.querySelectorAll('li').forEach(li => {
        const t = truncate(getInnerText(li), 150);
        if (t.length > 3) items.push(t);
      });
      if (items.length > 0) {
        results.push(makeSlide({ type: 'bullets', title: sectionTitle, items: items.slice(0, 6) }));
      }
    } else if (tag === 'OL') {
      const stepsArr = [];
      child.querySelectorAll('li').forEach((li, idx) => {
        const text = getInnerText(li);
        const parts = text.split(/[.:\-—](.+)/);
        stepsArr.push({ number: idx + 1, title: truncate(parts[0], 80), description: truncate(parts[1] || '', 200) });
      });
      if (stepsArr.length > 0) {
        results.push(makeSlide({ type: 'steps', title: sectionTitle, steps: stepsArr }));
      }
    } else if (tag === 'P') {
      const text = truncate(getInnerText(child), 500);
      if (text.length > 20) {
        results.push(makeSlide({ type: 'concept', title: sectionTitle, text }));
      }
    }
  }
  return results;
}

// ── Quiz generation from context ─────────────────────────────────────

function generateQuizFromSlides(slides, insertAfterIndex) {
  // Look back at recent slides for content to quiz on
  const lookback = slides.slice(Math.max(0, insertAfterIndex - 6), insertAfterIndex);
  const conceptSlides = lookback.filter(s => s.type === 'concept' || s.type === 'bullets' || s.type === 'table');

  if (conceptSlides.length === 0) return null;

  // Pick the most content-rich slide
  const source = conceptSlides[conceptSlides.length - 1];
  let question, choices, correctIndex, explanation;

  if (source.type === 'bullets' && source.items?.length >= 3) {
    // Quiz about one of the bullet items
    const correctItem = source.items[0];
    question = `Parmi les points abordés sur "${source.title || 'ce sujet'}", lequel est correct ?`;
    choices = [
      truncate(correctItem, 100),
      'Aucun des points mentionnés n\'est valide',
      'Ce sujet n\'a pas été couvert dans cette section',
      'Toutes les réponses sont fausses',
    ];
    correctIndex = 0;
    explanation = `En effet, ${truncate(correctItem, 200)} est l'un des points clés abordés.`;
  } else if (source.type === 'table' && source.rows?.length > 0) {
    const firstRow = source.rows[0];
    question = `D'après le tableau "${source.title || 'présenté'}", quel est le premier élément listé ?`;
    choices = [
      firstRow[0],
      source.rows.length > 1 ? source.rows[1][0] : 'Option B',
      'Aucun de ceux-ci',
      'Ce tableau n\'a pas été présenté',
    ];
    correctIndex = 0;
    explanation = `Le premier élément du tableau est bien "${firstRow[0]}".`;
  } else {
    // Generic concept quiz
    const text = source.text || '';
    const title = source.title || 'le sujet abordé';
    question = `Quel concept clé vient d'être expliqué dans la section "${truncate(title, 60)}" ?`;
    const keyPhrase = truncate(text.split('.')[0], 100);
    choices = [
      keyPhrase || 'Le concept principal de cette section',
      'Un sujet complètement différent',
      'Ce point n\'a pas été mentionné',
      'Aucune de ces réponses',
    ];
    correctIndex = 0;
    explanation = truncate(text, 200) || `C'est bien le sujet de cette section.`;
  }

  return makeSlide({
    type: 'quiz',
    question,
    choices,
    correctIndex,
    explanation,
  });
}

// ── Chapter summary generation ───────────────────────────────────────

function generateChapterSummary(chapterSlides, chapterTitle, chapterNum) {
  const items = [];

  // Extract key points from content slides
  for (const slide of chapterSlides) {
    if (slide.type === 'concept' && slide.text) {
      const firstSentence = slide.text.split('.')[0];
      if (firstSentence.length > 15 && firstSentence.length < 120) {
        items.push(firstSentence);
      }
    } else if (slide.type === 'bullets' && slide.items?.length > 0) {
      items.push(truncate(slide.items[0], 100));
    } else if (slide.type === 'warning') {
      items.push(`Attention : ${truncate(slide.title || slide.text, 80)}`);
    } else if (slide.type === 'tip') {
      items.push(`Conseil : ${truncate(slide.text, 80)}`);
    }
    if (items.length >= 5) break;
  }

  if (items.length === 0) {
    items.push(`Points clés du chapitre ${chapterNum} couverts.`);
  }

  return makeSlide({
    type: 'summary',
    title: `Chapitre ${chapterNum} — À Retenir`,
    items: items.slice(0, 5),
  });
}

// ── Narration generator (matches generate-edu-content.mjs) ───────────

function generateNarration(slides, config) {
  return slides.map((slide) => {
    let text = '';
    switch (slide.type) {
      case 'chapter-intro':
        text = `Chapitre ${slide.chapter.partNumber} sur ${slide.chapter.totalParts}. ${slide.chapter.title}. ${slide.chapter.subtitle || ''}`;
        break;
      case 'bullets':
        text = `${slide.title || ''}. ${(slide.items || []).join('. ')}`;
        break;
      case 'concept':
        text = `${slide.title || 'Concept clé'}. ${slide.text}`;
        break;
      case 'table':
        text = `${slide.title || 'Tableau comparatif'}. ${(slide.headers || []).join(', ')}. ${(slide.rows || []).slice(0, 4).map(r => r.join(', ')).join('. ')}`;
        break;
      case 'quote':
        text = `Citation : ${slide.text}. ${slide.source || ''}`;
        break;
      case 'steps':
        text = `${slide.title || 'Les étapes'}. ${(slide.steps || []).map(s => `Étape ${s.number}, ${s.title}. ${s.description}`).join('. ')}`;
        break;
      case 'warning':
        text = `Attention ! ${slide.title || ''}. ${slide.text}`;
        break;
      case 'tip':
        text = `Conseil pro : ${slide.title ? slide.title + '. ' : ''}${slide.text}`;
        break;
      case 'summary':
        text = `${slide.title || 'À retenir'}. ${(slide.items || []).join('. ')}`;
        break;
      case 'comparison':
        text = `${slide.title || 'Comparaison'}. D'un côté, ${slide.left?.label} : ${(slide.left?.items || []).join(', ')}. De l'autre, ${slide.right?.label} : ${(slide.right?.items || []).join(', ')}`;
        break;
      case 'quiz':
        text = `Petit quiz ! ${slide.question}. Les options sont : ${(slide.choices || []).map((c, i) => `${String.fromCharCode(65 + i)}, ${c}`).join('. ')}. Prenez un moment pour réfléchir. La bonne réponse est ${String.fromCharCode(65 + slide.correctIndex)}. ${slide.explanation || ''}`;
        break;
      default:
        text = slide.text || slide.title || '';
    }
    return {
      key: slide.audioFile.replace('.wav', ''),
      text: text.trim(),
      audioFile: slide.audioFile,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────

const quizPlaceholders = []; // unused collector, quizzes inserted inline

async function main() {
  console.log(`\nReading article: ${articlePath}`);
  const html = await fs.readFile(articlePath, 'utf-8');
  const article = parseArticle(html);

  console.log(`  Title: ${article.title}`);
  console.log(`  Language: ${article.lang}`);
  console.log(`  Sections found: ${article.sections.length}`);

  if (article.sections.length === 0) {
    console.error('No sections found in article. Cannot generate slides.');
    process.exit(1);
  }

  const totalChapters = article.sections.length;
  const allSlides = [];

  for (let i = 0; i < article.sections.length; i++) {
    const section = article.sections[i];
    console.log(`  Processing chapter ${i + 1}: ${section.title || '(untitled)'}`);

    const chapterSlides = extractSlidesFromSection(section, i + 1, totalChapters);
    const contentOnlySlides = chapterSlides.filter(s => s.type !== 'chapter-intro');

    // Insert quizzes every 8-12 content slides
    const withQuizzes = [chapterSlides[0]]; // chapter-intro first
    let sinceQuiz = 0;

    for (let j = 0; j < contentOnlySlides.length; j++) {
      withQuizzes.push(contentOnlySlides[j]);
      sinceQuiz++;

      if (sinceQuiz >= 8 && sinceQuiz <= 12 && j < contentOnlySlides.length - 2) {
        const quiz = generateQuizFromSlides(withQuizzes, withQuizzes.length);
        if (quiz) {
          withQuizzes.push(quiz);
          sinceQuiz = 0;
        }
      }
    }

    // Force a quiz if chapter had enough slides but none was inserted
    if (sinceQuiz >= 8 && contentOnlySlides.length >= 8) {
      const quiz = generateQuizFromSlides(withQuizzes, withQuizzes.length);
      if (quiz) withQuizzes.push(quiz);
    }

    // Chapter summary
    const summary = generateChapterSummary(contentOnlySlides, section.title, i + 1);
    withQuizzes.push(summary);

    allSlides.push(...withQuizzes);
  }

  // Config
  const config = {
    seriesTitle: article.title,
    seriesSubtitle: truncate(article.subtitle, 200),
    date: 'Mars 2026',
    language: article.lang,
    accentColor: article.accentColor,
    totalChapters,
  };

  const eduData = {
    config,
    slides: allSlides,
    audioDurations: {}, // filled after TTS
  };

  const narration = generateNarration(allSlides, config);

  await fs.writeJson('public/edu-data.json', eduData, { spaces: 2 });
  await fs.writeJson('public/edu-narration.json', narration, { spaces: 2 });

  // Stats
  const types = {};
  allSlides.forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });

  console.log(`\nGenerated ${allSlides.length} slides`);
  console.log(`  Types: ${Object.entries(types).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  console.log(`  Quizzes: ${types['quiz'] || 0}`);
  console.log(`  Chapters: ${totalChapters}`);
  console.log(`  Narration segments: ${narration.length}`);

  const estMinutes = Math.round(allSlides.length * 15 / 60);
  console.log(`  Estimated duration: ~${estMinutes} min (${Math.round(estMinutes / 60 * 10) / 10}h)`);
  console.log(`\nOutput files:`);
  console.log(`  public/edu-data.json (${Math.round(JSON.stringify(eduData).length / 1024)}KB)`);
  console.log(`  public/edu-narration.json (${Math.round(JSON.stringify(narration).length / 1024)}KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
