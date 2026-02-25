// assets/tag-renderer.js

// Tag metadata - MUST be kept in sync with index.html
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
 * Tags are read from a comma-separated string, typically from a data-tags attribute.
 * Clicking a tag redirects to the main page with that tag filtered.
 *
 * @param {string} tagsString - A comma-separated string of tags (e.g., "us,tech,ai").
 * @param {string} targetElementId - The ID of the DOM element where tags should be rendered.
 * @param {string} [defaultTab="analyses"] - The default tab to navigate to on index.html.
 */
function renderClickableTags(tagsString, targetElementId, defaultTab = "analyses") {
    const tagsContainer = document.getElementById(targetElementId);
    if (!tagsContainer || !tagsString) {
        return;
    }

    const tags = tagsString.split(",").filter(Boolean);
    tags.forEach(function(t) {
        const meta = tagMeta[t];
        if (meta) {
            const chip = document.createElement("span");
            chip.className = "card-tag";
            chip.setAttribute("data-cat", meta.cat);
            chip.textContent = meta.label;
            chip.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/index.html?tab=${defaultTab}&tags=` + t;
            };
            tagsContainer.appendChild(chip);
        }
    });
}

// Automatically render tags on DOMContentLoaded for a common ID and data attribute
document.addEventListener("DOMContentLoaded", function() {
    // Assumes the <html> element has a data-tags attribute and a data-tab attribute
    const articleTagsString = document.documentElement.dataset.tags;
    const articleDefaultTab = document.documentElement.dataset.tab || "analyses"; // Fallback to 'analyses' if not specified

    if (articleTagsString) {
        renderClickableTags(articleTagsString, "article-clickable-tags", articleDefaultTab);
    }
});
