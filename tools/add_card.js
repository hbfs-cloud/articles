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
let desc = "";
const metaDesc = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
if (metaDesc) desc = metaDesc.getAttribute('content');

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

// Append to json
const jsonFile = path.resolve(__dirname, `../data/${tab}.json`);
let cards = [];
if (fs.existsSync(jsonFile)) {
    cards = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
}
// Add to top
cards.unshift(cardHtml.trim());
fs.writeFileSync(jsonFile, JSON.stringify(cards, null, 2));
console.log(`Added card to ${tab}.json successfully.`);

// Rebuild search
const buildSearch = require('./build_search_module.js');
buildSearch();
