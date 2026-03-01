const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

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

let tab = doc.documentElement.getAttribute('data-tab');
if (!tab) {
    // try to guess from path
    if (argPath.includes('weekly/')) tab = 'weekly';
    else if (argPath.includes('daily/')) tab = 'daily';
    else if (argPath.includes('scanner/')) tab = 'scanner';
    else if (argPath.includes('analyses/')) tab = 'analyses';
    else if (argPath.includes('series/')) tab = 'series';
    else if (argPath.includes('tech/')) tab = 'tech';
    else tab = 'analyses';
}

const tags = doc.documentElement.getAttribute('data-tags') || "";
const grade = doc.documentElement.getAttribute('data-level') || ""; // "expert" or "beginner", etc. 
// analyses have actual grades. Let me use data-grade if it exists on html?
let finalGrade = doc.documentElement.getAttribute('data-grade') || "";

// Extract title and description
// Usually title is in <title> or h1
let title = doc.querySelector('title') ? doc.querySelector('title').textContent.split('|')[0].trim() : "";

// Try to grab a better title (e.g. the first h2 inside a content-card, or the main title)
if (tab === 'scanner') {
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
const tickerNameEl = doc.querySelector('.ticker-name');
if (tickerNameEl && tickerNameEl.textContent.includes('—')) {
    date = tickerNameEl.textContent.split('—')[1].trim();
} else if (tickerNameEl) {
    // maybe Daily / 26 Février 2026
    if (tickerNameEl.textContent.includes('—')) {
        date = tickerNameEl.textContent.split('—')[1].trim();
    } else {
        date = tickerNameEl.textContent.trim();
    }
} else {
    // fallback
    date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// For analyses, we have ticker logic
let ticker = "";
let exchange = "";
if (tab === 'analyses') {
    const symbolEl = doc.querySelector('.ticker-symbol');
    if (symbolEl) ticker = symbolEl.textContent.trim();
    const exchEl = doc.querySelector('.ticker-exchange');
    if (exchEl) exchange = exchEl.textContent.trim();
}

let href = argPath.replace(/\\/g, '/');
if (href.endsWith('index.html')) href = href.replace('index.html', '');
if (!href.startsWith('/')) href = '/' + href;
if (href.startsWith('//')) href = href.substring(1);

let badgeHtml = '';
if (tab === 'scanner' && html.includes('RÉTROSPECTIVE')) {
    badgeHtml += '<span class="badge badge-purple" style="margin-bottom: 1rem; display: inline-block">RÉTROSPECTIVE</span>\n';
}

let cardHtml = `
<div class="report-card" data-tags="${tags}" ${finalGrade ? `data-grade="${finalGrade}"` : ''}>
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
<div class="report-card" data-grade="${finalGrade}" data-tags="${tags}">
    <div class="ticker-card-header">
    <div class="ticker-logo"><img src="https://assets.parqet.com/logos/symbol/${ticker}?format=jpg" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="ticker-fallback" style="display:none">${ticker.substring(0, 2)}</div>
    </div>
    <div class="ticker-info">
        <div class="ticker-symbol">${ticker} <span class="ticker-exchange">${exchange}</span></div>
        <div class="ticker-name">${title}</div>
    </div>
    <div class="ticker-grade-badge grade-${finalGrade ? finalGrade[0].toLowerCase() : 'u'}">${finalGrade || '?'}</div>
    </div>
    <p style="font-size: 0.85rem; color: var(--text-muted)">${desc}</p>
    <div class="actions">
    <a href="${href}" class="btn-read-primary">Analyser</a>
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
    // Analyses: archive the old card before replacing
    const oldIndex = cards.findIndex(c => c.includes(hrefPattern));
    if (oldIndex !== -1) {
        const archiveFile = path.resolve(__dirname, '../data/analyses_archive.json');
        let archive = [];
        if (fs.existsSync(archiveFile)) {
            archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
        }
        archive.unshift({ date: new Date().toISOString().slice(0, 10), card: cards[oldIndex] });
        fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
        cards.splice(oldIndex, 1);
        console.log(`Analyses: archived old card for ${href} → analyses_archive.json`);
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
