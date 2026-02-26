const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('../index.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const tabs = ['weekly', 'daily', 'analyses', 'scanner', 'tech', 'series'];
const content = {};

tabs.forEach(tab => {
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) {
        const grid = panel.querySelector('.grid-cards');
        if (grid) {
            const cards = Array.from(grid.querySelectorAll('.report-card'));
            content[tab] = cards.map(c => c.outerHTML);
            console.log(`Tab ${tab}: extracted ${cards.length} cards`);
        }
    }
});

// Ensure directory exists
if (!fs.existsSync('../data')) {
    fs.mkdirSync('../data');
}

// Write to individual JSON files
Object.keys(content).forEach(key => {
    fs.writeFileSync(`../data/${key}.json`, JSON.stringify(content[key], null, 2));
    console.log(`Wrote data/${key}.json with ${content[key].length} entries`);
});

// Create an updated index_new.html that reads from these files.
// We remove the innerHTML of .grid-cards for every panel
tabs.forEach(tab => {
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) {
        const grid = panel.querySelector('.grid-cards');
        if (grid) {
            grid.innerHTML = '';
            // Add a container for paging, empty for now
        }
    }
});

// Write intermediate HTML file
fs.writeFileSync('../index_new.html', dom.serialize());
console.log('Wrote index_new.html');
