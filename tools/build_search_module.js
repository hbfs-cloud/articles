const fs = require('fs');
const jsdom = require('jsdom');
const path = require('path');
const { JSDOM } = jsdom;

module.exports = function () {
    const dataDir = path.join(__dirname, '../data');

    const tabs = ['weekly', 'daily', 'analyses', 'scanner', 'tech', 'series'];
    const typeMapping = {
        weekly: 'hebdo',
        daily: 'daily',
        analyses: 'analyse',
        scanner: 'scanner',
        series: 'série',
        tech: 'tech'
    };
    const iconMapping = {
        weekly: 'fa-calendar-week',
        daily: 'fa-sun',
        analyses: 'fa-chart-column',
        scanner: 'fa-satellite-dish',
        series: 'fa-graduation-cap',
        tech: 'fa-microchip'
    };

    const searchData = [];

    tabs.forEach(tab => {
        const jsonPath = path.join(dataDir, `${tab}.json`);
        if (!fs.existsSync(jsonPath)) return;

        const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        items.forEach(html => {
            const dom = new JSDOM(html);
            const card = dom.window.document.body.firstElementChild;
            if (!card) return;

            let ticker = "";
            let exchange = "";
            let name = "";
            let title = "";
            let desc = "";
            let href = "";
            let date = "";

            let link = card.querySelector(".actions a") || card.querySelector("a[href]");
            if (!link) return;
            href = link.getAttribute("href");

            const h2 = card.querySelector("h2");
            const h3 = card.querySelector("h3");
            title = h2 ? h2.textContent.trim() : (h3 ? h3.textContent.trim() : "");

            const pDesc = card.querySelector("p");
            if (pDesc) desc = pDesc.textContent.trim();

            if (tab === 'analyses') {
                const hdr = card.querySelector(".ticker-card-header");
                const sym = hdr ? hdr.querySelector(".ticker-symbol") : null;
                const exch = hdr ? hdr.querySelector(".ticker-exchange") : null;
                ticker = sym ? sym.textContent.trim() : "";
                exchange = exch ? exch.textContent.trim() : "";
                name = title;
            } else {
                const meta = card.querySelector(".report-card-meta");
                if (meta) date = meta.textContent.trim();
            }

            searchData.push({
                type: typeMapping[tab],
                icon: iconMapping[tab],
                ticker: ticker,
                exchange: exchange,
                name: name,
                title: title,
                desc: desc,
                tags: card.dataset.tags || "",
                grade: card.dataset.grade || "",
                href: href,
                date: date
            });
        });
    });

    fs.writeFileSync(path.join(dataDir, 'search_data.js'), 'window.searchDataPrebuilt = ' + JSON.stringify(searchData, null, 2) + ';');
    console.log('Search index built successfully.');
}
