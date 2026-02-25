// assets/core.js

// Tag metadata with multi-language support
// Keys are used for filtering (?tags=key), labels are displayed to the user
const tagMeta = {
    // Region (cat: "region")
    us: { labels: { fr: "US", en: "US", ar: "أمريكا" }, cat: "region" },
    eu: { labels: { fr: "Europe", en: "Europe", ar: "أوروبا" }, cat: "region" },
    asia: { labels: { fr: "Asie", en: "Asia", ar: "آسيا" }, cat: "region" },
    crypto: { labels: { fr: "Crypto", en: "Crypto", ar: "كريبتو" }, cat: "region" },
    commodity: { labels: { fr: "Matières Premières", en: "Commodities", ar: "سلع" }, cat: "region" },
    forex: { labels: { fr: "Forex", en: "Forex", ar: "فوركس" }, cat: "region" },
    etf: { labels: { fr: "ETF", en: "ETF", ar: "صناديق" }, cat: "region" },
    
    // Sector (cat: "sector")
    tech: { labels: { fr: "Technologie", en: "Tech", ar: "تكنولوجيا" }, cat: "sector" },
    semis: { labels: { fr: "Semi-conducteurs", en: "Semis", ar: "أشباه الموصلات" }, cat: "sector" },
    healthcare: { labels: { fr: "Santé", en: "Healthcare", ar: "الرعاية الصحية" }, cat: "sector" },
    energy: { labels: { fr: "Énergie", en: "Energy", ar: "طاقة" }, cat: "sector" },
    financials: { labels: { fr: "Finance", en: "Financials", ar: "مالية" }, cat: "sector" },
    industrials: { labels: { fr: "Industrie", en: "Industrials", ar: "صناعة" }, cat: "sector" },
    materials: { labels: { fr: "Matériaux", en: "Materials", ar: "مواد" }, cat: "sector" },
    consumer: { labels: { fr: "Consommation", en: "Consumer", ar: "استهلاك" }, cat: "sector" },
    defense: { labels: { fr: "Défense", en: "Defense", ar: "دفاع" }, cat: "sector" },
    software: { labels: { fr: "Logiciel", en: "Software", ar: "برمجيات" }, cat: "sector" },
    
    // Theme (cat: "theme")
    ai: { labels: { fr: "IA", en: "AI", ar: "ذكاء اصطناعي" }, cat: "theme" },
    earnings: { labels: { fr: "Résultats", en: "Earnings", ar: "أرباح" }, cat: "theme" },
    geopolitique: { labels: { fr: "Géopolitique", en: "Geopolitics", ar: "جيوسياسة" }, cat: "theme" },
    macro: { labels: { fr: "Macro", en: "Macro", ar: "ماكرو" }, cat: "theme" },
    technique: { labels: { fr: "Technique", en: "Technical", ar: "تقني" }, cat: "theme" },
    options: { labels: { fr: "Options", en: "Options", ar: "خيارات" }, cat: "theme" },
    dividende: { labels: { fr: "Dividende", en: "Dividend", ar: "توزيعات" }, cat: "theme" },
    "small-cap": { labels: { fr: "Small Cap", en: "Small Cap", ar: "شركات صغيرة" }, cat: "theme" },
    speculative: { labels: { fr: "Spéculatif", en: "Speculative", ar: "مضاربة" }, cat: "theme" },
    education: { labels: { fr: "Éducation", en: "Education", ar: "تعليم" }, cat: "theme" },
    societe: { labels: { fr: "Société", en: "Society", ar: "مجتمع" }, cat: "theme" },
    securite: { labels: { fr: "Sécurité", en: "Security", ar: "أمن" }, cat: "theme" },
    architecture: { labels: { fr: "Architecture", en: "Architecture", ar: "هندسة" }, cat: "theme" },
    sql: { labels: { fr: "SQL", en: "SQL", ar: "SQL" }, cat: "theme" },
    snowflake: { labels: { fr: "Snowflake", en: "Snowflake", ar: "Snowflake" }, cat: "theme" },
    singer: { labels: { fr: "Singer", en: "Singer", ar: "Singer" }, cat: "theme" },
    opensource: { labels: { fr: "Open-Source", en: "Open-Source", ar: "مصدر مفتوح" }, cat: "theme" },
    
    // Content (cat: "content")
    "trade-idea": { labels: { fr: "Idée de Trade", en: "Trade Idea", ar: "فكرة تداول" }, cat: "content" },
    formation: { labels: { fr: "Formation", en: "Learning", ar: "تدريب" }, cat: "content" },
    retrospective: { labels: { fr: "Rétrospective", en: "Retrospective", ar: "مراجعة" }, cat: "content" },
};

/**
 * Renders clickable tags into a container with multi-language support.
 */
function renderClickableTags(tagsString, targetElementId, defaultTab = "analyses") {
    const tagsContainer = document.getElementById(targetElementId);
    if (!tagsContainer || !tagsString) return;

    // Detect language from <html> tag, default to English
    const lang = document.documentElement.lang || "en";
    
    tagsContainer.innerHTML = '';

    const tags = tagsString.split(",").map(t => t.trim()).filter(Boolean);
    tags.forEach(function(t) {
        const meta = tagMeta[t];
        if (meta) {
            const chip = document.createElement("span");
            chip.className = "card-tag";
            chip.setAttribute("data-cat", meta.cat);
            
            // Get translated label, fallback to English then key
            const label = meta.labels[lang] || meta.labels["en"] || t;
            chip.textContent = label;
            
            chip.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/index.html?tab=${defaultTab}&tags=` + t;
            };
            tagsContainer.appendChild(chip);
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const articleTagsString = document.documentElement.dataset.tags;
    const articleDefaultTab = document.documentElement.dataset.tab || "analyses";

    if (articleTagsString) {
        renderClickableTags(articleTagsString, "article-clickable-tags", articleDefaultTab);
    }
});
