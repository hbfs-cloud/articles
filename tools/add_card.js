const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

function getGradeColor(grade) {
    switch (grade) {
        case 'A+': case 'A': case 'A-': return '#059669'; // Green
        case 'B+': case 'B': case 'B-': return '#0d9488'; // Teal
        case 'C+': case 'C': case 'C-': return '#f59e0b'; // Amber
        case 'D+': case 'D': case 'D-': return '#ef4444'; // Red
        case 'F': return '#7f1d1d'; // Dark Red
        default: return '#64748b'; // Gray
    }
}

const argPath = process.argv[2];
if (!argPath) {
    console.error("Usage: node add_card_to_index.js <path/to/article/index.html>");
    process.exit(1);
}

const fullPath = path.resolve(__dirname, '..', argPath);
if (!fs.existsSync(fullPath)) {
    console.error("File not found: " + fullPath);
    process.exit(1);
}

// Determine tab
const html = fs.readFileSync(fullPath, 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Path-based tab detection takes priority over data-tab for series/
// (series HTML uses data-tab="analyses" for tag-renderer but cards go to series.json)
let tab;
if (argPath.includes('series/')) tab = 'series';
else if (argPath.includes('weekly/')) tab = 'weekly';
else if (argPath.includes('daily/')) tab = 'daily';
else if (argPath.includes('scanner/')) tab = 'scanner';
else if (argPath.includes('tech/')) tab = 'tech';
else if (argPath.includes('analyses/')) tab = 'analyses';
else tab = doc.documentElement.getAttribute('data-tab') || 'analyses';

// GUARD: Skip sub-parts of multi-part series/tech articles.
// Only the landing page or part1 should get a card, not part2, part3, etc.
// Matches patterns like /part2-xxx/, /part3-xxx/, etc.
const subPartMatch = argPath.match(/\/part(\d+)-/);
if (subPartMatch && parseInt(subPartMatch[1]) > 1) {
    console.log(`Skipped: ${argPath} is a sub-part (part ${subPartMatch[1]}). Only landing pages and part1 get indexed as cards.`);
    process.exit(0);
}

const tags = doc.documentElement.getAttribute('data-tags') || "";
const grade = doc.documentElement.getAttribute('data-level') || ""; // "expert" or "beginner", etc.
// analyses have actual grades. Let me use data-grade if it exists on html?
let finalGrade = doc.documentElement.getAttribute('data-grade') || "";
let reliability = doc.documentElement.getAttribute('data-reliability') || "Medium";

// Detect available languages for this article
function detectArticleLangs(articleDir) {
    const langs = new Set();
    // 1. Check variants.json
    const variantsPath = path.join(articleDir, 'variants.json');
    if (fs.existsSync(variantsPath)) {
        try {
            const variants = JSON.parse(fs.readFileSync(variantsPath, 'utf8'));
            if (variants.variants) variants.variants.forEach(v => { if (v.lang) langs.add(v.lang); });
            if (langs.size > 0) return Array.from(langs).sort().join(',');
        } catch (e) { /* ignore */ }
    }
    // 2. Check <html lang="...">
    const mainLang = doc.documentElement.getAttribute('lang');
    if (mainLang) langs.add(mainLang);
    // 3. Check language subdirectories
    for (const lang of ['en', 'fr', 'ar', 'es', 'zh']) {
        if (fs.existsSync(path.join(articleDir, lang, 'index.html'))) langs.add(lang);
        for (const level of ['beginner', 'expert']) {
            if (fs.existsSync(path.join(articleDir, level, lang, 'index.html'))) langs.add(lang);
        }
    }
    if (langs.size === 0) langs.add('fr');
    return Array.from(langs).sort().join(',');
}
const articleDir = path.dirname(fullPath);
const dataLang = detectArticleLangs(articleDir);

// Extract title and description
let title = doc.querySelector('title') ? doc.querySelector('title').textContent.split('|')[0].trim() : "";

// For analyses: build a better title from ticker + og:title or description
if (tab === 'analyses') {
    // Try og:title first (often has "Market Watch — Analyse TICKER Expert")
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const ogDesc = doc.querySelector('meta[property="og:description"]');
    const tickerSym = doc.querySelector('.ticker-symbol');
    const sym = tickerSym ? tickerSym.textContent.trim() : '';

    if (ogDesc && sym) {
        // Build: "TICKER — <short description from og:description>"
        let shortDesc = ogDesc.getAttribute('content');
        // Remove leading "TICKER :" or "TICKER —" if already present to avoid "IOVA — IOVA : ..."
        shortDesc = shortDesc.replace(new RegExp(`^${sym}\\s*[:—–-]\\s*`, 'i'), '');
        // Truncate to ~80 chars for card title
        if (shortDesc.length > 90) shortDesc = shortDesc.substring(0, 87) + '...';
        title = `${sym} — ${shortDesc}`;
    } else if (ogTitle && sym) {
        title = ogTitle.getAttribute('content').replace(/Market Watch\s*[—–-]\s*/i, '').trim();
        if (!title.includes(sym)) title = `${sym} — ${title}`;
    }
    // Fallback: if title is still generic like "Market Watch Expert", use ticker + company
    if (/^Market Watch/i.test(title) && sym) {
        const nameEl = doc.querySelector('.ticker-name');
        if (nameEl) {
            const dashIdx = nameEl.textContent.indexOf('—');
            const shortName = dashIdx !== -1 ? nameEl.textContent.substring(0, dashIdx).trim() : nameEl.textContent.trim();
            title = `${sym} — ${shortName}`;
        }
    }
} else if (tab === 'scanner') {
    // For scanner: build a rich title from og:description (has regime + tickers)
    // e.g. "Top 10 setups A+ — Régime EARLY RISK-OFF — 5 US + 2 EU + 1 APAC + 2 ETFs"
    const ogDesc = doc.querySelector('meta[property="og:description"]');
    if (ogDesc) {
        const ogText = ogDesc.getAttribute('content');
        // Extract regime from badge or og:description
        const regimeMatch = ogText.match(/Régime\s+(\S+(?:\s+\S+)?)/i);
        const regime = regimeMatch ? regimeMatch[1] : '';
        // Extract tickers from setup cards (id="setup-TICKER")
        const setupCards = Array.from(doc.querySelectorAll('[id^="setup-"]'));
        const tickers = setupCards.map(el => el.id.replace('setup-', '')).filter(Boolean).slice(0, 10);
        if (tickers.length > 0 && regime) {
            title = `Top ${tickers.length} A+ ${regime} — ${tickers.join(', ')}`;
        } else if (regime) {
            title = `Top 10 A+ ${regime}`;
        }
    }
} else if (tab === 'daily' || tab === 'weekly') {
    // Prefer hero-title (h1) which is the real article title
    const heroTitle = doc.querySelector('.hero-title, h1.hero-title');
    if (heroTitle) {
        title = heroTitle.textContent.trim();
    } else {
        const h2s = Array.from(doc.querySelectorAll('h2'));
        const betterTitle = h2s.find(h => /Top 10|Briefing|Hebdo|Macro/i.test(h.textContent));
        if (betterTitle) {
            title = betterTitle.textContent.trim();
        }
    }
}

let desc = "";
const metaDesc = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
if (metaDesc) desc = metaDesc.getAttribute('content');

if (tab === 'scanner' || tab === 'daily' || tab === 'weekly') {
    // If we have a specific overview paragraph, that's much better than the meta desc.
    // Daily/Scanner typically have a <p> after an h2 in a content-card.
    // Or we can find the first paragraph inside `.content-card` that has some length.
    const pEl = Array.from(doc.querySelectorAll('.content-card p')).find(p => p.textContent.trim().length > 50);
    if (pEl) {
        desc = pEl.textContent.trim();
        // Truncate to a reasonable length if too long
        if (desc.length > 300) desc = desc.substring(0, 300) + '...';
    }
}

// For daily/scanner/weekly, we have dates
let date = "";

// For analyses, we have ticker logic
let ticker = "";
let companyName = "";
let exchangeAndSector = "";
if (tab === 'analyses') {
    const symbolEl = doc.querySelector('.ticker-symbol');
    if (symbolEl) ticker = symbolEl.textContent.trim();

    // Extract company name from .ticker-name — text before the first "—" (rendered from &mdash;)
    const companyNameEl = doc.querySelector('.ticker-name');
    if (companyNameEl) {
        const textContent = companyNameEl.textContent.trim();
        // JSDOM renders &mdash; as actual — character, not &mdash; entity
        const dashIdx = textContent.indexOf('—');
        if (dashIdx !== -1) {
            companyName = textContent.substring(0, dashIdx).trim();
        } else {
            companyName = textContent;
        }
    }

    // Extract exchange/sector — first try .ticker-exchange, then parse from .ticker-name after "—"
    const exchangeEl = doc.querySelector('.ticker-exchange');
    if (exchangeEl) {
        exchangeAndSector = exchangeEl.textContent.trim();
    } else if (companyNameEl) {
        const textContent = companyNameEl.textContent.trim();
        const dashIdx = textContent.indexOf('—');
        if (dashIdx !== -1) {
            exchangeAndSector = textContent.substring(dashIdx + 1).trim();
            // Clean up: remove leading/trailing bullets and whitespace
            exchangeAndSector = exchangeAndSector.replace(/^[•·\s]+/, '').replace(/[•·\s]+$/, '');
        }
    }

    // Extract date for analyses cards
    // 1. Try <title> tag — often contains "DD Mois YYYY" or "Month DD, YYYY"
    const titleText = doc.querySelector('title') ? doc.querySelector('title').textContent : '';
    const titleDateMatch = titleText.match(/(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/i)
        || titleText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (titleDateMatch) {
        date = titleDateMatch[1].trim();
    }

    // 2. Try og:article:published_time
    if (!date) {
        const ogPublishedTime = doc.querySelector('meta[property="article:published_time"]');
        if (ogPublishedTime) {
            const d = new Date(ogPublishedTime.getAttribute('content'));
            if (!isNaN(d)) {
                const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
        }
    }

    // 3. Try extracting date from the folder path (analyses/TICKER/ created date or weekly/YYYYMMDD/)
    if (!date) {
        const folderMatch = argPath.match(/(\d{8})/);
        if (folderMatch) {
            const ds = folderMatch[1];
            const d = new Date(`${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`);
            if (!isNaN(d)) {
                const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                date = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
        }
    }

    // 4. Last fallback: today's date
    if (!date) {
        const now = new Date();
        const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
        date = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
}

let href = argPath.replace(/\\/g, '/');
// Strip absolute project path if present (handles agents passing full paths)
const projectRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');
if (href.startsWith(projectRoot)) href = href.substring(projectRoot.length);
if (href.endsWith('index.html')) href = href.replace('index.html', '');
if (!href.startsWith('/')) href = '/' + href;
if (href.startsWith('//')) href = href.substring(1);

// Date extraction for non-analyses tabs
if (tab === 'daily' || tab === 'weekly' || tab === 'scanner') {
    const tickerNameEl = doc.querySelector('.ticker-name'); // This is usually in the hero-title or similar
    if (tickerNameEl && tickerNameEl.textContent.includes('—')) {
        date = tickerNameEl.textContent.split('—')[1].trim();
    } else if (tickerNameEl) {
        date = tickerNameEl.textContent.trim();
    } else {
        // fallback
        date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
}

let badgeHtml = '';
if (tab === 'scanner' && html.includes('RÉTROSPECTIVE')) {
    badgeHtml += '<span class="badge badge-purple" style="margin-bottom: 1rem; display: inline-block">RÉTROSPECTIVE</span>\n';
}

let cardHtml = `
<div class="report-card" data-lang="${dataLang}" data-tags="${tags}" ${finalGrade ? `data-grade="${finalGrade}"` : ''}>
    ${badgeHtml}
    ${date ? `<div class="report-card-meta">${date}</div>` : ''}
    <h2 style="font-size: 1.3rem; margin: 0.5rem 0 0.75rem">${title}</h2>
    <p style="font-size: 0.85rem; color: var(--text-muted)">${desc}</p>
    <div class="actions" style="flex-direction: column; gap: 0.5rem; margin-top: 1rem">
    <a href="${href}" class="btn-read-primary" style="width: 100%">Voir l'article</a>
    </div>
</div>
`;

if (tab === 'analyses') {
    // Custom HTML for analyses
    cardHtml = `
<div class="report-card" data-lang="${dataLang}" data-grade="${finalGrade}" data-tags="${tags}" data-conf="${reliability}">
    <div class="ticker-card-header">
        <div class="ticker-logo">
            <img src="https://assets.parqet.com/logos/symbol/${ticker}?format=jpg" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="ticker-logo-fallback" style="display:none; background: linear-gradient(135deg, var(--accent), #7c3aed); color: white; font-weight: 800; font-size: 0.8rem; width: 100%; height: 100%; align-items: center; justify-content: center; border-radius: 10px;">${ticker.substring(0, 4)}</div>
        </div>
        <div>
            <div class="ticker-symbol">${ticker}</div>
            <div class="ticker-exchange">${exchangeAndSector}</div>
        </div>
        <button onclick="openChart('${ticker}', '${companyName}')" style="
                  margin-left: auto;
                  background: none;
                  border: 1px solid #e2e8f0;
                  color: var(--text-muted);
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 6px;
                  font-size: 0.7rem;
                " title="View chart">
              <i class="fa-solid fa-chart-line"></i>
            </button>
        <div class="ticker-grade-badge grade-${finalGrade ? finalGrade[0].toLowerCase() : 'u'}">${finalGrade || '?'}</div>
    </div>
    <div class="report-card-meta">
        ${date}
        <span class="grade-badge" style="background: ${getGradeColor(finalGrade)}; color: #fff">${finalGrade}</span>
    </div>
    <h2 style="font-size: 1.5rem; margin: 0.5rem 0 1rem">${title}</h2>
    <p style="font-size: 0.85rem; color: var(--text-muted)">${desc}</p>
    <div class="actions">
        <a href="${href}" class="btn-read-primary" style="width: 100%">Read Analysis</a>
    </div>
</div>
`;
}

// Append to json — behavior depends on tab type
const jsonFile = path.resolve(__dirname, `../data/${tab}.json`);
let cards = [];
if (fs.existsSync(jsonFile)) {
    cards = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
}

const hrefPattern = `href="${href}"`;

if (tab === 'daily') {
    // Daily: no dedup, entries just accumulate (one per day)
    cards.unshift(cardHtml.trim());

} else if (tab === 'analyses') {
    // Analyses: dedup by ticker symbol (not exact href — handles path changes like beginner/fr/ → root)
    // Match any card that has the same ticker in ticker-symbol div or in the href path
    const tickerForDedup = ticker || '';
    let removedCount = 0;
    if (tickerForDedup) {
        const archiveFile = path.resolve(__dirname, '../data/analyses_archive.json');
        let archive = [];
        if (fs.existsSync(archiveFile)) {
            archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
        }
        const newCards = [];
        for (const c of cards) {
            // Match by: ticker-symbol content, or href containing /analyses/TICKER/
            const tickerPattern = new RegExp(`analyses/${tickerForDedup}[/"\\s]`, 'i');
            const symbolPattern = new RegExp(`ticker-symbol">${tickerForDedup}<`, 'i');
            if (tickerPattern.test(c) || symbolPattern.test(c)) {
                archive.unshift({ date: new Date().toISOString().slice(0, 10), card: c });
                removedCount++;
            } else {
                newCards.push(c);
            }
        }
        cards = newCards;
        if (removedCount > 0) {
            fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
            console.log(`Analyses: archived ${removedCount} old card(s) for ${tickerForDedup} → analyses_archive.json`);
        }
    }
    cards.unshift(cardHtml.trim());

} else {
    // Scanner, weekly, tech, series: dedup (overwrite)
    const before = cards.length;
    cards = cards.filter(c => !c.includes(hrefPattern));
    const removed = before - cards.length;
    if (removed > 0) {
        console.log(`Dedup: replaced ${removed} existing card(s) for ${href}`);
    }
    cards.unshift(cardHtml.trim());
}

fs.writeFileSync(jsonFile, JSON.stringify(cards, null, 2));
console.log(`Added card to ${tab}.json successfully.`);

// Rebuild search
const buildSearch = require('./build_search_module.js');
buildSearch();
