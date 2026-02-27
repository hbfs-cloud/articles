/**
 * update_history.js — Auto-updates the HistoryModal in an analysis index.html
 * by scanning the archive/ directory for old versions.
 *
 * Usage: node tools/update_history.js analyses/{TICKER}/index.html
 *
 * What it does:
 * 1. Scans analyses/{TICKER}/archive/ for dated folders (YYYYMMDD)
 * 2. Extracts the current version date from the article
 * 3. Rebuilds the entire historyModal block with current + archived entries
 * 4. Replaces the old modal in-place in the HTML file
 */

const fs = require('fs');
const path = require('path');

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function formatDate(yyyymmdd) {
    const y = yyyymmdd.substring(0, 4);
    const m = parseInt(yyyymmdd.substring(4, 6), 10) - 1;
    const d = parseInt(yyyymmdd.substring(6, 8), 10);
    return `${d} ${MONTHS_FR[m]} ${y}`;
}

function extractTicker(filePath) {
    // analyses/WULF/index.html → WULF
    const parts = filePath.replace(/\\/g, '/').split('/');
    const idx = parts.indexOf('analyses');
    if (idx >= 0 && idx + 1 < parts.length) return parts[idx + 1];
    return 'TICKER';
}

function extractCurrentDate(html) {
    // Try og:article:published_time or meta date
    let m = html.match(/property="article:published_time"\s+content="([^"]+)"/);
    if (m) {
        const d = new Date(m[1]);
        return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
    }
    // Try ticker-name with date pattern
    m = html.match(/class="ticker-name"[^>]*>.*?(\d{1,2}\s+\w+\s+\d{4})/s);
    if (m) return m[1];
    // Try from the existing historyModal current entry
    m = html.match(/Actuel[\s\S]*?(\d{1,2}\s+\w+\s+\d{4})/);
    if (m) return m[1];
    // Fallback to today
    const now = new Date();
    return `${now.getDate()} ${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;
}

function extractCurrentPrice(html) {
    // Try to find price from ticker-price
    const m = html.match(/class="ticker-price"[^>]*>\s*\$?([\d.,]+)/);
    if (m) return `$${m[1]}`;
    return '';
}

function buildModal(ticker, currentDate, currentPrice, archiveDates) {
    const priceText = currentPrice ? ` &mdash; ${currentPrice}` : '';

    const currentEntry = `
                <!-- Current version -->
                <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; background:#f0fdf4; border:1px solid #22c55e; border-radius:10px;">
                    <div style="width:40px; height:40px; border-radius:8px; background:#dcfce7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-star" style="color:#22c55e;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:700; font-size:0.9rem; color:#0f172a;">${currentDate} <span style="background:#22c55e; color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px; margin-left:6px;">ACTUEL</span></div>
                        <div style="font-size:0.75rem; color:#64748b;">Analyse ${ticker} &mdash; Version actuelle${priceText}</div>
                    </div>
                </div>`;

    const archiveEntries = archiveDates.map(d => `
                <!-- Archive ${d} -->
                <a href="archive/${d}/" style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; border:1px solid #e2e8f0; border-radius:10px; text-decoration:none; color:#0f172a; transition:all 0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fa-solid fa-file-lines" style="color:#64748b;"></i>
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${formatDate(d)}</div>
                        <div style="font-size:0.75rem; color:#64748b;">Analyse ${ticker} &mdash; Version précédente</div>
                    </div>
                </a>`).join('');

    return `<!-- History Modal -->
    <div id="historyModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;" onclick="if(event.target===this)this.style.display='none'">
        <div style="background:white; border-radius:16px; padding:2rem; max-width:420px; width:90%; box-shadow:0 25px 50px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="margin:0; font-size:1.2rem; color:#0f172a;">Historique &mdash; ${ticker}</h3>
                <button onclick="document.getElementById('historyModal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b; line-height:1;">&times;</button>
            </div>
            <div id="historyList" style="display:flex; flex-direction:column; gap:0.75rem;">${currentEntry}${archiveEntries}
            </div>
            <p style="font-size:0.7rem; color:#94a3b8; margin:1rem 0 0; text-align:center;">Les anciennes versions sont archivées automatiquement lors de chaque mise à jour.</p>
        </div>
    </div>`;
}

// --- Main ---
const argPath = process.argv[2];
if (!argPath) {
    console.error('Usage: node tools/update_history.js analyses/{TICKER}/index.html');
    process.exit(1);
}

const fullPath = path.resolve(__dirname, '..', argPath);
if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath);
    process.exit(1);
}

const ticker = extractTicker(argPath);
const tickerDir = path.dirname(fullPath);
const archiveDir = path.join(tickerDir, 'archive');

// Scan archive folder
let archiveDates = [];
if (fs.existsSync(archiveDir)) {
    archiveDates = fs.readdirSync(archiveDir)
        .filter(d => /^\d{8}$/.test(d) && fs.statSync(path.join(archiveDir, d)).isDirectory())
        .sort()
        .reverse(); // most recent first
}

if (archiveDates.length === 0) {
    console.log(`${ticker}: no archive/ entries found, nothing to update.`);
    process.exit(0);
}

let html = fs.readFileSync(fullPath, 'utf8');
const currentDate = extractCurrentDate(html);
const currentPrice = extractCurrentPrice(html);

const newModal = buildModal(ticker, currentDate, currentPrice, archiveDates);

// Replace existing historyModal or insert before Finviz chart
const modalRegex = /<!-- History Modal -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=\s*(?:<!--\s*Finviz|<div[^>]*class="container"|<div[^>]*max-width|<footer))/;
if (modalRegex.test(html)) {
    html = html.replace(modalRegex, newModal);
    console.log(`${ticker}: updated historyModal with ${archiveDates.length} archive(s): ${archiveDates.join(', ')}`);
} else {
    // Try a simpler pattern: find the historyModal div by id
    const simpleRegex = /<div id="historyModal"[\s\S]*?<p style="font-size:0\.7rem[^"]*"[^>]*>Les anciennes versions[^<]*<\/p>\s*<\/div>\s*<\/div>/;
    if (simpleRegex.test(html)) {
        html = html.replace(simpleRegex, newModal);
        console.log(`${ticker}: updated historyModal (simple match) with ${archiveDates.length} archive(s)`);
    } else {
        console.error(`${ticker}: could not find historyModal block to replace. Add it manually first.`);
        process.exit(1);
    }
}

fs.writeFileSync(fullPath, html);
console.log(`${ticker}: saved ${argPath}`);
