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

// For analyses, we have ticker logic
let ticker = "";
let companyName = ""; // New variable for company name
let exchangeAndSector = ""; // New variable for exchange and sector
if (tab === 'analyses') {
    const symbolEl = doc.querySelector('.ticker-symbol');
    if (symbolEl) ticker = symbolEl.textContent.trim();

    const companyNameEl = doc.querySelector('.ticker-name'); // e.g. "Applied Digital Corporation — AI Infrastructure & HPC"
    if (companyNameEl) {
        const textContent = companyNameEl.textContent.trim();
        const companyNameMatch = textContent.match(/^(.*?)\s*&mdash;/); // Extract up to "—"
        if (companyNameMatch && companyNameMatch[1]) {
            companyName = companyNameMatch[1].trim();
        } else {
            companyName = textContent; // Fallback to full content if "—" not found
        }
    }

    const exchangeEl = doc.querySelector('.ticker-exchange'); // e.g. "NASDAQ • Technology / Data Centers"
    if (exchangeEl) {
        exchangeAndSector = exchangeEl.textContent.trim();
    } else {
        // Fallback: if ticker-exchange not found, try to extract from ticker-name after "—"
        const tickerNameFull = doc.querySelector('.ticker-name');
        if (tickerNameFull && tickerNameFull.textContent.includes('—')) {
            const exchangeMatch = tickerNameFull.textContent.match(/&mdash;\s*(.*)/);
            if (exchangeMatch && exchangeMatch[1]) {
                exchangeAndSector = exchangeMatch[1].replace(/&amp;/g, '&').trim();
            }
        }
    // Extract date for analyses cards
    // Look for various date patterns or common containers
    let dateEl = doc.querySelector('.ticker-date') || doc.querySelector('.hero-section div[style*="font-size:0.8rem"], .hero-section div[style*="font-size: 0.8rem"], div[style*="margin-top:0.75rem"]');
    if (!dateEl) {
        // Broad search for anything that looks like a date container in hero
        const divs = Array.from(doc.querySelectorAll('.hero-section div'));
        dateEl = divs.find(d => d.textContent.includes('2026') || d.textContent.includes('2025'));
    }

    if (dateEl) {
        const text = dateEl.textContent.trim();
        // Match "4 Mars 2026" or "March 4, 2026"
        const dateMatch = text.match(/([0-9]+\s+[A-Za-zÀ-ÿ]+\s+[0-9]{4})/i) || text.match(/([A-Za-z]+\s+[0-9]+\s*,\s*[0-9]{4})/i);
        if (dateMatch) {
            date = dateMatch[1].trim();
        } else {
            // Fallback: try splitting by bullet
            const parts = text.split(/[•·]|&bull;/);
            if (parts.length > 0 && parts[0].trim().length > 5) {
                date = parts[0].trim();
            }
        }
    }
    
    if (!date) {
        // Fallback to og:article:published_time if no specific div is found
        const ogPublishedTime = doc.querySelector('meta[property="article:published_time"]');
        if (ogPublishedTime) {
            date = new Date(ogPublishedTime.getAttribute('content')).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        }
    }
}
}

let href = argPath.replace(/\\/g, '/');
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
        <div class="ticker-logo">
            <img src="https://assets.parqet.com/logos/symbol/${ticker}?format=jpg" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="ticker-logo-fallback" style="display:none; background: linear-gradient(135deg, var(--accent), #7c3aed); color: white; font-weight: 800; font-size: 0.8rem; width: 100%; height: 100%; align-items: center; justify-content: center; border-radius: 12px;">${ticker.substring(0, 4)}</div>
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
