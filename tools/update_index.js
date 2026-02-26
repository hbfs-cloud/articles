const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('../index_new.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

// We need to write the pagination logic into the <script> block
// Let's create a script tag to load the content as needed.

const scriptContent = `
    const itemsPerPage = 12;
    const tabState = {
        weekly: { data: [], page: 0, loaded: false },
        daily: { data: [], page: 0, loaded: false },
        analyses: { data: [], page: 0, loaded: false },
        scanner: { data: [], page: 0, loaded: false },
        tech: { data: [], page: 0, loaded: false },
        series: { data: [], page: 0, loaded: false }
    };

    function loadTabContent(tab) {
        if (tabState[tab].loaded) return;
        
        fetch('/data/' + tab + '.json')
            .then(r => r.json())
            .then(data => {
                tabState[tab].data = data;
                tabState[tab].loaded = true;
                
                // Keep the static content inside the panel, we just append to .grid-cards
                const panel = document.getElementById('tab-' + tab);
                const grid = panel.querySelector('.grid-cards');
                grid.innerHTML = '';
                
                // Add first page
                renderPage(tab);
                
                // Add "Load More" button if needed
                if (data.length > itemsPerPage) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.className = 'btn-action';
                    loadMoreBtn.innerText = 'Charger plus';
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.style.margin = '2rem auto';
                    loadMoreBtn.onclick = () => renderPage(tab, loadMoreBtn);
                    panel.appendChild(loadMoreBtn);
                }
                
                // Update count
                const countEl = document.getElementById(tab + 'Count');
                if (countEl) countEl.innerText = data.length;
                
                applyAllFilters();
            })
            .catch(e => console.error("Failed to load generic tab data", e));
    }

    function renderPage(tab, btnElement = null) {
        const state = tabState[tab];
        const panel = document.getElementById('tab-' + tab);
        const grid = panel.querySelector('.grid-cards');
        const start = state.page * itemsPerPage;
        const end = Math.min(start + itemsPerPage, state.data.length);
        
        for (let i = start; i < end; i++) {
            // insert adjacent HTML will make filtering work, although the DOM might be altered 
            // when filtering. Let's just create a wrapper to innerHTML assignment.
            const wrapper = document.createElement('div');
            wrapper.innerHTML = state.data[i];
            const card = wrapper.firstElementChild;
            grid.appendChild(card);
        }
        
        state.page++;
        
        // Hide button if all content is shown
        if (end >= state.data.length && btnElement) {
            btnElement.style.display = 'none';
        }
        
        applyAllFilters();
    }
    
    // Override switchTab to load content dynamically
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        originalSwitchTab(tabId);
        loadTabContent(tabId);
    };

    // Load initial active tab data
    document.addEventListener("DOMContentLoaded", () => {
        const activeTab = document.querySelector('.main-tab.active');
        if (activeTab) {
            loadTabContent(activeTab.dataset.tab);
        }
    });
`;

const newScript = document.createElement('script');
newScript.innerHTML = scriptContent;
document.body.appendChild(newScript);

fs.writeFileSync('../index_new_with_paging.html', dom.serialize());
console.log('Wrote index_new_with_paging.html');
