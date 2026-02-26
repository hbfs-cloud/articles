const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

const tabs = ['weekly', 'daily', 'analyses', 'scanner', 'tech', 'series'];

tabs.forEach(tab => {
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) {
        const grid = panel.querySelector('.grid-cards');
        if (grid) {
            grid.innerHTML = ''; // Clear cards
        }
    }
});

// Create new element for load content
const scriptTag = document.createElement('script');
scriptTag.textContent = `
const itemsPerPage = 12;
const tabState = {
    weekly: { data: [], page: 0, loaded: false },
    daily: { data: [], page: 0, loaded: false },
    analyses: { data: [], page: 0, loaded: false },
    scanner: { data: [], page: 0, loaded: false },
    tech: { data: [], page: 0, loaded: false },
    series: { data: [], page: 0, loaded: false }
};

function renderCards(tab, reset = false) {
    const state = tabState[tab];
    const panel = document.getElementById('tab-' + tab);
    const grid = panel.querySelector('.grid-cards');
    
    if (reset) {
        grid.innerHTML = '';
        state.page = 0;
    }
    
    const start = state.page * itemsPerPage;
    const end = Math.min(start + itemsPerPage, state.data.length);
    
    for (let i = start; i < end; i++) {
        // We use insertAdjacentHTML directly for cleaner code
        grid.insertAdjacentHTML('beforeend', state.data[i]);
    }
    
    state.page++;
    
    let btnContainer = panel.querySelector('.load-more-container');
    if (!btnContainer && end < state.data.length) {
        btnContainer = document.createElement('div');
        btnContainer.className = 'load-more-container';
        btnContainer.style.textAlign = 'center';
        btnContainer.style.marginTop = '2rem';
        btnContainer.style.marginBottom = '2rem';
        
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn-action';
        loadMoreBtn.textContent = 'Charger plus';
        loadMoreBtn.onclick = () => { renderCards(tab); applyAllFilters(); };
        btnContainer.appendChild(loadMoreBtn);
        panel.appendChild(btnContainer);
    }
    
    if (btnContainer && end >= state.data.length) {
        btnContainer.style.display = 'none';
    }
}

function loadTabContent(tab) {
    if (tabState[tab].loaded) {
        return; // Already fetched
    }
    
    fetch('/data/' + tab + '.json')
        .then(r => r.json())
        .then(data => {
            tabState[tab].data = data;
            tabState[tab].loaded = true;
            
            // Render first page
            renderCards(tab, true);
            
            // Apply current filters
            if (typeof applyAllFilters === 'function') {
                applyAllFilters();
            }
        })
        .catch(e => console.error("Failed to load tab data", e));
}

// Intercept existing switchTab function
document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch for the active tab
    const activeBtn = document.querySelector('.main-tab.active');
    if (activeBtn) {
        loadTabContent(activeBtn.dataset.tab);
    }
    
    // Add click listeners to tabs
    document.querySelectorAll('.main-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            setTimeout(() => { loadTabContent(this.dataset.tab); }, 50); // Small delay to let switchTab run
        });
    });
});
`;

document.body.appendChild(scriptTag);
fs.writeFileSync('index.html', dom.serialize());
console.log('Successfully updated index.html for infinite scroll loading JSON');
