// assets/core.js

// Tag metadata - MUST be kept in sync with index.html taxonomy
const tagMeta = {
    // Region (blue)
    us: { label: "US", cat: "region" },
    eu: { label: "EU", cat: "region" },
    asia: { label: "Asia", cat: "region" },
    crypto: { label: "Crypto", cat: "region" },
    commodity: { label: "Commodity", cat: "region" },
    forex: { label: "Forex", cat: "region" },
    etf: { label: "ETF", cat: "region" },
    // Sector (green)
    tech: { label: "Tech", cat: "sector" },
    semis: { label: "Semis", cat: "sector" },
    healthcare: { label: "Healthcare", cat: "sector" },
    energy: { label: "Energy", cat: "sector" },
    financials: { label: "Financials", cat: "sector" },
    industrials: { label: "Industrials", cat: "sector" },
    materials: { label: "Materials", cat: "sector" },
    consumer: { label: "Consumer", cat: "sector" },
    defense: { label: "Defense", cat: "sector" },
    software: { label: "Software", cat: "sector" },
    // Theme (purple)
    ai: { label: "AI", cat: "theme" },
    earnings: { label: "Earnings", cat: "theme" },
    geopolitique: { label: "Géopolitique", cat: "theme" },
    macro: { label: "Macro", cat: "theme" },
    technique: { label: "Technique", cat: "theme" },
    options: { label: "Options", cat: "theme" },
    dividende: { label: "Dividende", cat: "theme" },
    "small-cap": { label: "Small Cap", cat: "theme" },
    speculative: { label: "Spéculatif", cat: "theme" },
    education: { label: "Éducation", cat: "theme" },
    societe: { label: "Société", cat: "theme" },
    securite: { label: "Sécurité", cat: "theme" },
    architecture: { label: "Architecture", cat: "theme" },
    sql: { label: "SQL", cat: "theme" },
    snowflake: { label: "Snowflake", cat: "theme" },
    singer: { label: "Singer", cat: "theme" },
    opensource: { label: "Open-Source", cat: "theme" },
    // Content (amber)
    "trade-idea": { label: "Trade Idea", cat: "content" },
    formation: { label: "Formation", cat: "content" },
    retrospective: { label: "Rétrospective", cat: "content" },
};

/**
 * Renders clickable tags into a specified container element.
 *
 * @param {string} tagsString - A comma-separated string of tags.
 * @param {string} targetElementId - The ID of the container element.
 * @param {string} [defaultTab="analyses"] - The tab to navigate to on index.html.
 */
function renderClickableTags(tagsString, targetElementId, defaultTab = "analyses") {
    const tagsContainer = document.getElementById(targetElementId);
    if (!tagsContainer || !tagsString) return;

    // Clear existing content if any
    tagsContainer.innerHTML = '';

    const tags = tagsString.split(",").map(t => t.trim()).filter(Boolean);
    tags.forEach(function(t) {
        const meta = tagMeta[t];
        if (meta) {
            const chip = document.createElement("span");
            chip.className = "card-tag"; // Matches the new CSS class
            chip.setAttribute("data-cat", meta.cat);
            chip.textContent = meta.label;
            chip.style.cursor = "pointer";
            chip.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/index.html?tab=${defaultTab}&tags=` + t;
            };
            tagsContainer.appendChild(chip);
        }
    });
}

// Automatically render tags on DOMContentLoaded
document.addEventListener("DOMContentLoaded", function() {
    const articleTagsString = document.documentElement.dataset.tags;
    const articleDefaultTab = document.documentElement.dataset.tab || "analyses";

    if (articleTagsString) {
        renderClickableTags(articleTagsString, "article-clickable-tags", articleDefaultTab);
    }
});
