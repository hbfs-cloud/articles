#!/usr/bin/env node
/**
 * update-scanner-perf.js — Met à jour le bloc "Performance du Scanner" dans index.html
 * Doit être lancé après chaque publication de rétrospective.
 *
 * Usage: node tools/update-scanner-perf.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

// 1. Découvrir toutes les rétros
const retroDir = path.join(ROOT, 'scanner', 'retrospective');
const retroDates = fs.readdirSync(retroDir)
    .filter(d => /^\d{8}$/.test(d))
    .sort();

if (!retroDates.length) {
    console.log('Aucune rétrospective trouvée.');
    process.exit(0);
}

const retros = [];
for (const date of retroDates) {
    const htmlPath = path.join(retroDir, date, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Grade
    const gradeEl = doc.querySelector('.retro-grade');
    const grade = gradeEl ? gradeEl.textContent.trim().replace(/\s+/g, '') : '?';

    // OG description
    const ogEl = doc.querySelector('meta[property="og:description"]');
    const og = ogEl ? ogEl.getAttribute('content') : '';

    // Setups depuis og description
    const setupsMatch = og.match(/(\d+)\s+setups?/i);
    const setups = setupsMatch ? parseInt(setupsMatch[1]) : 0;

    // Hit Rate depuis og description (prend le premier % mentionné avec HR)
    const hrMatch = og.match(/(\d+(?:\.\d+)?)\s*%\s*HR|HR[^:]*:\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%.*?hit.rate|hit.rate.*?(\d+(?:\.\d+)?)\s*%/i);
    const hr = hrMatch ? parseFloat(hrMatch[1] || hrMatch[2] || hrMatch[3] || hrMatch[4]) : 0;

    // Best pick depuis og (TICKER +XX%)
    const posMatches = [...og.matchAll(/([A-Z]{2,6})\s+\+(\d+(?:\.\d+)?)\s*%/g)];
    const negMatches = [...og.matchAll(/([A-Z]{2,6})\s+-(\d+(?:\.\d+)?)\s*%/g)];

    // Période depuis title
    const title = doc.querySelector('title') ? doc.querySelector('title').textContent : '';
    const periodMatch = title.match(/([A-Za-z]+ \d+)\s*[-–]\s*([A-Za-z]+ \d+,?\s*\d{4})/);

    retros.push({ date, grade, setups, hr, og, posMatches, negMatches, period: periodMatch });
}

// 2. Calculer les stats cumulées
const nRetros = retros.length;
const totalSetups = retros.reduce((s, r) => s + r.setups, 0);

// Weighted HR
const weightedHR = totalSetups > 0
    ? retros.reduce((s, r) => s + r.hr * r.setups, 0) / totalSetups
    : 0;

// Best/worst pick à travers toutes les retros
let bestPick = { pct: 0, ticker: '', date: '' };
let worstPick = { pct: 0, ticker: '', date: '' };

for (const r of retros) {
    for (const m of r.posMatches) {
        const pct = parseFloat(m[2]);
        if (pct > bestPick.pct) bestPick = { pct, ticker: m[1], date: r.date };
    }
    for (const m of r.negMatches) {
        const pct = parseFloat(m[2]);
        if (pct > worstPick.pct) worstPick = { pct, ticker: m[1], date: r.date };
    }
}

// Grade final = grade de la dernière retro
const lastRetro = retros[retros.length - 1];
const lastGrade = lastRetro.grade;

// Période totale = début de la première retro → fin de la dernière
const firstDate = retros[0].date;
const lastDate = lastRetro.date;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = d => new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`);
const fmtDate = d => { const dt = parseDate(d); return `${months[dt.getMonth()]} ${dt.getDate()}`; };
const fmtDateFull = d => { const dt = parseDate(d); return `${months[dt.getMonth()]} ${dt.getDate()} ${dt.getFullYear()}`; };

const periodStr = `${fmtDate(firstDate)} – ${fmtDateFull(lastDate)}`;
const updatedStr = fmtDateFull(lastDate);

// Compter les scans
const scanDirs = fs.readdirSync(path.join(ROOT, 'scanner'))
    .filter(d => /^\d{8}$/.test(d))
    .length;

// Formatter les chiffres
const hrStr = `~${Math.round(weightedHR)}%`;
const gradeDisplay = lastGrade.includes('*') ? lastGrade : lastGrade + '*';

// Format date pour best/worst
function retroDateToLabel(dateStr) {
    const dt = parseDate(dateStr);
    return `${months[dt.getMonth()]} ${dt.getDate()}`;
}

console.log('=== Stats cumulées ===');
console.log(`Rétros: ${nRetros} | Setups: ${totalSetups} | Scans: ${scanDirs}`);
console.log(`Weighted HR: ${hrStr}`);
console.log(`Grade final: ${gradeDisplay}`);
console.log(`Best pick: +${bestPick.pct}% ${bestPick.ticker} (${retroDateToLabel(bestPick.date || lastDate)})`);
console.log(`Worst pick: -${worstPick.pct}% ${worstPick.ticker} (${retroDateToLabel(worstPick.date || lastDate)})`);
console.log(`Période: ${periodStr}`);
console.log(`Updated: ${updatedStr}`);

// 3. Mettre à jour index.html
let indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Updated + Period
indexHtml = indexHtml.replace(
    /Updated: [^—]+— Period: [^<]+ \(\d+ rétros cumulées\)/,
    `Updated: ${updatedStr} — Period: ${periodStr} (${nRetros} rétros cumulées)`
);

// Grade badge (C* / B+ / etc.)
indexHtml = indexHtml.replace(
    /(<div style="[^"]*gradient.*?f97316[^"]*"[^>]*>\s*)([A-F][+-]?\*?)\s*(<\/div>\s*<i class="fa-solid fa-chevron-down)/,
    `$1${gradeDisplay}$3`
);

// Hit Rate
indexHtml = indexHtml.replace(
    /(~\d+%)\s*(<\/div>\s*<div[^>]*>Weighted HR — \d+ rétros cumulées<\/div>)/,
    `${hrStr}$2`
);

// Weighted HR label
indexHtml = indexHtml.replace(
    /Weighted HR — \d+ rétros cumulées/,
    `Weighted HR — ${nRetros} rétros cumulées`
);

// Best pick
if (bestPick.ticker) {
    indexHtml = indexHtml.replace(
        /(\+)\d+(?:\.\d+)?%\s*(<\/div>\s*<div[^>]*>[A-Z]+[^<]*<\/div>\s*<\/div>\s*<div[^>]*>.*?Scans)/s,
        (match, p1, p2) => `${p1}${bestPick.pct}%${p2}`
    );
    indexHtml = indexHtml.replace(
        />[A-Z]+\s*\([A-Za-z]+ \d+\)<\/div>(\s*<\/div>\s*<div[^>]*>.*?Scans)/s,
        `>${bestPick.ticker} (${retroDateToLabel(bestPick.date)})<\/div>$1`
    );
}

// Scans count
indexHtml = indexHtml.replace(
    /(<div[^>]*font-size: 1\.5rem[^>]*>\s*)\d+(\s*<\/div>\s*<div[^>]*>\d+ setups • \d+ rétros<\/div>)/,
    `$1${scanDirs}$2`
);

// Setups + rétros count
indexHtml = indexHtml.replace(
    /\d+ setups • \d+ rétros/,
    `${totalSetups} setups • ${nRetros} rétros`
);

// Worst pick value
if (worstPick.ticker) {
    indexHtml = indexHtml.replace(
        /(-)\d+(?:\.\d+)?%\s*(<\/div>\s*<div[^>]*>[A-Z]+ 🚫)/,
        `$1${worstPick.pct}%$2`
    );
    indexHtml = indexHtml.replace(
        />[A-Z]+ 🚫 \([A-Za-z]+ \d+\)<\/div>(\s*<\/div>\s*<div[^>]*>.*?Régime)/s,
        `>${worstPick.ticker} 🚫 (${retroDateToLabel(worstPick.date)})<\/div>$1`
    );
}

fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml);
console.log('\n✅ index.html mis à jour avec les stats du scanner.');
