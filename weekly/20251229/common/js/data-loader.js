window.loadData = loadPeriod;

let equityChartInstance = null;
let riskRewardChartInstance = null;
let drawdownChartInstance = null;
let timeAllocChartInstance = null;
let currentCurrencyRate = 1.0; // Default USD
let currentCurrencySymbol = "€";

// Proxies & Thematic Mapping for Portfolio Visualization (e.g. NVDA -> Crypto proxy)
const PROXY_MAP = {
    'MSTR': 'Crypto', 'COIN': 'Crypto', 'NVDA': 'Crypto', 'MARA': 'Crypto', 'RIOT': 'Crypto', 'CLSK': 'Crypto',
    'HUT': 'Crypto', 'WULF': 'Crypto', 'CIFR': 'Crypto', 'BITF': 'Crypto', 'IREN': 'Crypto', 'IBIT': 'Crypto',
    'EQX': 'Gold', 'GOLD': 'Gold', 'NEM': 'Gold', 'AEM': 'Gold', 'IAG': 'Gold', 'NGD': 'Gold', 'ITRG': 'Gold',
    'USAS': 'Gold', 'GLD': 'Gold', 'PAAS': 'Silver', 'EXK': 'Silver', 'SIL': 'Silver', 'SLV': 'Silver',
    'CDE': 'Silver', 'FSM': 'Silver', 'AG': 'Silver', 'HL': 'Silver', 'SILJ': 'Silver',
    'URA': 'Uranium', 'CCJ': 'Uranium', 'NXE': 'Uranium', 'UEC': 'Uranium', 'DNN': 'Uranium', 'EU': 'Uranium',
    'AMD': 'Tech', 'MU': 'Tech', 'AVGO': 'Tech', 'SMH': 'Tech', 'PLTR': 'Tech', 'CRWD': 'Tech', 'NET': 'Tech',
    'ZS': 'Tech', 'FTNT': 'Tech', 'ANET': 'Tech', 'PANW': 'Tech', 'MDB': 'Tech', 'SNOW': 'Tech', 'DDOG': 'Tech',
    'TEAM': 'Tech', 'OKTA': 'Tech', 'ASML': 'Tech', 'TSM': 'Tech', 'ARM': 'Tech', 'SOXX': 'Tech'
};

function calculateTacticalAllocation(positions, cashPct) {
    const alloc = { "Crypto & Proxies": 0, "Precious Metals": 0, "Technology & AI": 0, "Energy & Uranium": 0, "Other Strategies": 0, "Cash": cashPct || 0 };
    positions.forEach(p => {
        const baseSym = p.symbol ? p.symbol.split('.')[0] : '';
        const theme = PROXY_MAP[baseSym] || PROXY_MAP[p.symbol] || 'Other';
        if (theme === 'Crypto') alloc["Crypto & Proxies"] += p.weight_pct;
        else if (theme === 'Gold' || theme === 'Silver') alloc["Precious Metals"] += p.weight_pct;
        else if (theme === 'Tech') alloc["Technology & AI"] += p.weight_pct;
        else if (theme === 'Uranium') alloc["Energy & Uranium"] += p.weight_pct;
        else alloc["Other Strategies"] += p.weight_pct;
    });
    return alloc;
}

document.addEventListener('DOMContentLoaded', () => {
    // Load default period (1Y) if not already triggered by inline script
    if (!window.dataLoaded) loadPeriod('current');

    // Add event listeners to period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            e.target.classList.remove('bg-gray-100', 'text-gray-600');
            e.target.classList.add('active', 'bg-blue-600', 'text-white');
        });
    });
});

async function loadPeriod(period) {
    window.dataLoaded = true;
    const timestamp = new Date().getTime();
    try {
        const [portfolioResponse, opsResponse] = await Promise.all([
            fetch(`../../common/data/portfolio_${period}.json?v=${timestamp}`),
            fetch(`../../common/data/opportunities.json?v=${timestamp}`).catch(() => null)
        ]);
        if (!portfolioResponse.ok) throw new Error("Portfolio data not found");
        const data = await portfolioResponse.json();
        const opportunities = (opsResponse && opsResponse.ok) ? await opsResponse.json() : [];

        window.globalTradeLogs = data.trade_logs || [];
        window.globalOpportunities = opportunities;

        updateStats(data.stats);
        updateChart(data);
        updateRiskRewardChart(data);
        updateDrawdownComparisonChart(data);

        if (data.trade_logs) updateLogs(data.trade_logs);
        if (data.stats && data.stats.current_positions) {
            updatePositions(data.stats.current_positions, data.trade_logs);
            updatePendingOrders(data.stats.current_positions, opportunities);
            const tacticalAlloc = calculateTacticalAllocation(data.stats.current_positions, data.stats.cash_pct || 2.0);
            updateTimeAllocationChart(tacticalAlloc);
        }

        if (data.system_events) {
            updateTimeline(data.system_events);
            updateCalendarView(data);
        }

        updateMonthlyHeatmap(data);
        if (typeof mermaid !== 'undefined') {
            setTimeout(() => { try { mermaid.init(undefined, ".mermaid"); } catch (e) { } }, 800);
        }
        updateEduStats(data);
    } catch (e) {
        console.error("Error loading data:", e);
    }
}

function updateStats(stats) {
    const updateElement = (id, value, colorClass = null) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = value;
            if (colorClass) el.className = colorClass;
        }
    };

    updateElement('stat-total-return', (stats.total_return_pct >= 0 ? '+' : '') + stats.total_return_pct.toFixed(1) + '%');
    updateElement('stat-cagr', stats.cagr_pct ? stats.cagr_pct.toFixed(1) + '%' : 'N/A');
    if (stats.sharpe_ratio) updateElement('stat-sharpe', stats.sharpe_ratio.toFixed(2));
    if (stats.max_dd_pct) updateElement('stat-max-dd', '-' + Math.abs(stats.max_dd_pct).toFixed(1) + '%');

    if (document.getElementById('stat-balance')) {
        document.getElementById('stat-balance').innerText = '€' + Math.round(stats.final_balance).toLocaleString();
    }

    if (stats.win_rate_pct !== undefined) updateElement('stat-winrate', stats.win_rate_pct.toFixed(1) + '%');
    if (stats.profit_factor !== undefined) updateElement('stat-profitfactor', stats.profit_factor.toFixed(2));
    if (stats.max_trade_win !== undefined) updateElement('stat-maxwin', '+' + currentCurrencySymbol + stats.max_trade_win.toFixed(0), 'text-emerald-600 font-bold');
    if (stats.max_trade_loss !== undefined) updateElement('stat-maxloss', currentCurrencySymbol + stats.max_trade_loss.toFixed(0), 'text-rose-600 font-bold');

    if (stats.risk_metrics) {
        if (stats.risk_metrics.var_99_monte_carlo_pct) updateElement('stat-var99', '-' + Math.abs(stats.risk_metrics.var_99_monte_carlo_pct).toFixed(2) + '%');
        if (stats.risk_metrics.beta) updateElement('stat-beta', stats.risk_metrics.beta.toFixed(2));
        if (stats.risk_metrics.greeks && stats.risk_metrics.greeks.vega) {
            updateElement('stat-vega', stats.risk_metrics.greeks.vega.toFixed(2));
        }

        const mpList = document.getElementById('list-maxpain');
        if (mpList && stats.risk_metrics.max_pain_list) {
            mpList.innerHTML = stats.risk_metrics.max_pain_list.slice(0, 5).map(p => {
                const pnlClass = p.pnl_pct >= 0 ? '#16a34a' : '#dc2626';
                const pnlSign = p.pnl_pct >= 0 ? '+' : '';
                return `
                <div style="border-bottom:1px dashed #f1f5f9; padding-bottom:4px; margin-bottom:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; color:#334155;">${p.flag || ''} ${p.ticker}</span>
                        <span style="font-weight:700; color:#9333ea;">$${p.max_pain}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#64748b;">
                        <span>Price $${p.price.toFixed(0)} <span style="font-size:0.65rem; color:#cbd5e1;">(${p.expiry.split(' ')[0] || ''})</span></span>
                        <span style="font-weight:600; color:${pnlClass};">${pnlSign}${p.pnl_pct.toFixed(1)}%</span>
                    </div>
                </div>`;
            }).join('');
        }
    }

    const eventList = document.getElementById('event-calendar-list');
    if (eventList && stats.event_calendar) {
        eventList.innerHTML = stats.event_calendar.map(evt => `
            <div class="flex items-center justify-between p-3 rounded-lg ${evt.impact === 'High' ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}">
                <div class="flex flex-col">
                    <span class="text-xs font-bold ${evt.impact === 'High' ? 'text-red-600' : 'text-gray-500'} uppercase tracking-wider">${evt.date}</span>
                    <span class="text-sm font-semibold text-gray-900">${evt.event}</span>
                </div>
                <span class="text-xs font-bold px-2 py-1 rounded-full ${evt.impact === 'High' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}">${evt.impact}</span>
            </div>
        `).join('');
    }

    if (stats.allocation_radar && document.getElementById('radarChart')) {
        const ctxRadar = document.getElementById('radarChart');
        if (window.radarChartInstance) window.radarChartInstance.destroy();

        window.radarChartInstance = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: Object.keys(stats.allocation_radar),
                datasets: [{
                    label: 'Allocation %',
                    data: Object.values(stats.allocation_radar),
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    pointBackgroundColor: '#6366f1',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        ticks: { display: true, backdropColor: 'transparent', font: { size: 9 }, color: '#94a3b8', maxTicksLimit: 4 },
                        grid: { color: '#cbd5e1' },
                        angleLines: { color: '#cbd5e1' },
                        suggestedMin: 0
                    }
                }
            }
        });

        if (stats.allocation_region) {
            const regionDiv = document.getElementById('region-allocation');
            if (regionDiv) {
                let rHtml = '<div style="display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center;">';
                const sortedR = Object.entries(stats.allocation_region).sort((a, b) => b[1] - a[1]);
                sortedR.forEach(([r, v]) => {
                    if (v > 0.5) {
                        const flag = r === 'US' ? '🇺🇸' : (r === 'HK' ? '🇭🇰' : (r === 'EU' ? '🇪🇺' : (r === 'COMMOD' ? '🌍' : '')));
                        rHtml += `
                         <span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0; display:flex; align-items:center;">
                            <span style="margin-right:4px;">${flag}</span> <strong>${r}</strong> <span style="margin-left:4px; color:#0f172a;">${v.toFixed(1)}%</span>
                         </span>`;
                    }
                });
                rHtml += '</div>';
                regionDiv.innerHTML = rHtml;
            }
        }
    }

    if (stats.benchmarks) {
        const benchList = document.getElementById('benchmark-list');
        if (benchList) {
            const portRet = stats.total_return_pct;
            const portVol = stats.risk_metrics.volatility_annualized;

            let html = `
             <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:0.5rem; font-size:0.75rem; font-weight:bold; color:#64748b; margin-bottom:0.5rem; padding-bottom:0.25rem; border-bottom:1px solid #f1f5f9;">
                <span>Asset</span>
                <span style="text-align:right;">Return</span>
                <span style="text-align:right;">Vol (Risk)</span>
             </div>
             <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:0.5rem; background:#eff6ff; padding:0.5rem; border-radius:0.375rem; border:1px solid #dbeafe; margin-bottom:0.5rem; align-items:center;">
                <span style="color:#1d4ed8; font-weight:bold;">Portfolio</span>
                <span style="text-align:right; color:#1d4ed8; font-weight:bold;">${portRet > 0 ? '+' : ''}${portRet.toFixed(1)}%</span>
                <span style="text-align:right; color:#334155; font-weight:bold;">${portVol.toFixed(1)}%</span>
             </div>
             `;

            const refs = ['SPY', 'GLD', 'BTC-USD', 'SI=F', 'CL=F'];
            const list = refs.map(sym => {
                const d = stats.benchmarks[sym];
                return d ? { sym, ret: d.return_pct, vol: d.volatility_pct } : null;
            }).filter(x => x);
            list.push({ sym: 'Inflation (CPI)', ret: 2.5, vol: 1.2 });

            list.forEach(item => {
                const symName = item.sym === 'BTC-USD' ? 'Bitcoin' : (item.sym === 'GLD' ? 'Gold' : (item.sym === 'SPY' ? 'S&P 500' : (item.sym === 'SI=F' ? 'Silver' : (item.sym === 'CL=F' ? 'Crude Oil' : item.sym))));
                const alpha = portRet - item.ret;
                const alphaColor = alpha >= 0 ? '#16a34a' : '#ef4444';
                const alphaSign = alpha >= 0 ? '+' : '';

                html += `
                 <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:0.5rem; padding:0.25rem 0.5rem; align-items:center; font-size:0.85rem;">
                    <span style="font-weight:500; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${symName}</span>
                    <div style="text-align:right; display:flex; flex-direction:column;">
                        <span style="color:#0f172a;">${item.ret > 0 ? '+' : ''}${item.ret.toFixed(1)}%</span>
                        <span style="font-size:0.7rem; color:${alphaColor}; font-family:monospace;">α ${alphaSign}${alpha.toFixed(1)}%</span>
                    </div>
                    <span style="text-align:right; color:#64748b; font-family:monospace;">${item.vol.toFixed(1)}%</span>
                 </div>`;
            });

            benchList.innerHTML = html;
        }
    }
}

function updateChart(data) {
    const ctx = document.getElementById('equityCurveChart');
    if (!ctx) return;

    const curveData = data.equity_curve;
    const dates = curveData.map(d => d.date);

    // Normalize Portfolio to %
    const startEq = curveData[0].equity;
    const values = curveData.map(d => ((d.equity - startEq) / startEq) * 100);

    if (equityChartInstance) {
        equityChartInstance.destroy();
    }

    const datasets = [{
        label: 'Portfolio (%)',
        data: values,
        borderColor: '#2563eb', // Blue
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1
    }];

    if (data.benchmarks) {
        const colors = {
            'SPY': '#f97316', 'GLD': '#eab308', 'DIA': '#475569', 'IWM': '#9333ea', 'SI=F': '#9ca3af', 'BTC-USD': '#f59e0b'
        };
        const labels = {
            'SPY': 'S&P 500', 'GLD': 'Gold', 'DIA': 'Dow Jones', 'IWM': 'Russell 2000', 'SI=F': 'Silver', 'BTC-USD': 'Bitcoin'
        };

        ['SPY', 'GLD'].forEach(sym => {
            if (data.benchmarks[sym]) {
                const bCurve = data.benchmarks[sym];
                if (bCurve && bCurve.length > 0) {
                    const bStart = bCurve[0];
                    const bValues = bCurve.map(v => ((v - bStart) / bStart) * 100);
                    datasets.push({
                        label: labels[sym] || sym,
                        data: bValues,
                        borderColor: colors[sym] || '#000',
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1,
                        borderDash: sym === 'SPY' ? [] : [5, 5]
                    });
                }
            }
        });
    }

    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: { mode: 'index', intersect: false, callbacks: { label: c => c.dataset.label + ': ' + (c.parsed.y > 0 ? '+' : '') + c.parsed.y.toFixed(2) + '%' } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: { display: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } }
            }
        }
    });
}

function updateRiskRewardChart(data) {
    const ctx = document.getElementById('riskRewardChart');
    if (!ctx) return;

    const portRet = data.stats.total_return_pct;
    const portDD = Math.abs(data.stats.max_dd_pct);

    const points = [{ x: portDD, y: portRet, label: 'Portfolio', r: 8, bg: '#2563eb' }];

    if (data.benchmarks) {
        const colors = { 'SPY': '#f97316', 'GLD': '#eab308', 'BTC-USD': '#f59e0b', 'Inflation': '#ef4444' };
        // Simple benchmark approximation needed OR pass BenchmarkStats. 
        // Assuming we access Pre-Calculated Benchmark Stats or calc on fly:

        // Simpler: Just put standard benchmarks if available in curve
        Object.keys(data.benchmarks).forEach(sym => {
            if (['SPY', 'GLD', 'BTC-USD'].includes(sym)) {
                let c = data.benchmarks[sym];
                if (c && c.length) {
                    // Calc Return
                    let r = ((c[c.length - 1] - c[0]) / c[0]) * 100;
                    // Calc DD
                    let pk = -Infinity, mdd = 0;
                    c.forEach(v => { if (v > pk) pk = v; else mdd = Math.max(mdd, (pk - v) / pk); });
                    mdd *= 100;

                    points.push({ x: mdd, y: r, label: sym, r: 6, bg: colors[sym] || '#64748b' });
                }
            }
        });
    }

    if (riskRewardChartInstance) riskRewardChartInstance.destroy();

    riskRewardChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Risk/Reward',
                data: points,
                backgroundColor: points.map(p => p.bg),
                pointRadius: points.map(p => p.r)
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.label}: +${c.raw.y.toFixed(1)}% / -${c.raw.x.toFixed(1)}% DD` } } },
            scales: {
                x: { title: { display: true, text: 'Max Drawdown (%) - Risk' }, min: 0 },
                y: { title: { display: true, text: 'Total Return (%) - Reward' } }
            }
        }
    });
}

function updateDrawdownComparisonChart(data) {
    const ctx = document.getElementById('drawdownComparisonChart');
    if (!ctx) return;
    if (window.drawdownChartInstance) window.drawdownChartInstance.destroy();

    const getDD = (arr) => {
        let pk = -Infinity;
        return arr.map(v => {
            const val = typeof v === 'object' ? v.equity : v;
            if (val > pk) pk = val;
            return ((val - pk) / pk) * 100;
        });
    };

    const dates = data.equity_curve.map(d => d.date);
    const portDD = getDD(data.equity_curve);

    const datasets = [
        { label: 'Portfolio', data: portDD, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', borderWidth: 2, fill: true, pointRadius: 0, tension: 0 }
    ];

    if (data.benchmarks && data.benchmarks['SPY']) {
        datasets.push({ label: 'S&P 500', data: getDD(data.benchmarks['SPY']), borderColor: '#94a3b8', borderWidth: 1, fill: false, pointRadius: 0, tension: 0, borderDash: [4, 4] });
    }

    window.drawdownChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' }, tooltip: { mode: 'index', intersect: false, callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(2) + '%' } } },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: { x: { display: false }, y: { title: { display: true, text: 'Drawdown %' }, grid: { color: '#f1f5f9' }, suggestedMin: -25 } }
        }
    });
}

function updateLogs(logs) {
    window.allLogs = logs;
    renderLogs(logs.slice().reverse().slice(0, 100));
}

window.filterLogs = function (mode) {
    const logs = window.allLogs; if (!logs) return;
    const container = document.getElementById('logs-table-body');
    container.innerHTML = '';

    document.querySelectorAll('.log-filter-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-white', 'text-slate-600');
    });
    const activeBtn = document.getElementById('btn-ft-' + mode);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-slate-600');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }

    if (mode === 'list') { renderLogs(logs.slice().reverse().slice(0, 100)); return; }

    if (mode === 'by_symbol') {
        const map = {};
        logs.forEach(l => {
            if (!map[l.symbol]) map[l.symbol] = { count: 0, pnl: 0, wins: 0, losses: 0 };
            map[l.symbol].count++;
            if (l.pnl) {
                map[l.symbol].pnl += l.pnl;
                if (l.pnl > 0) map[l.symbol].wins++; else if (l.pnl < 0) map[l.symbol].losses++;
            }
        });
        const sorted = Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl);
        container.innerHTML = sorted.map(([sym, stats]) => `
             <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-3 px-4 font-bold text-slate-800">${sym}</td>
                <td class="py-3 px-4 text-center font-mono text-xs">${stats.count} Trades</td>
                <td class="py-3 px-4 text-center text-emerald-600 font-bold text-xs">${stats.wins} Wins</td>
                <td class="py-3 px-4 text-center text-rose-600 font-bold text-xs">${stats.losses} Losses</td>
                <td class="py-3 px-4 text-right font-bold ${stats.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-mono" colspan="3">${currentCurrencySymbol}${stats.pnl.toFixed(0)}</td>
             </tr>`).join('');
        return;
    }

    if (mode === 'by_date') {
        const map = {};
        logs.forEach(l => {
            const d = l.date.substring(0, 7);
            if (!map[d]) map[d] = { count: 0, pnl: 0 };
            map[d].count++; if (l.pnl) map[d].pnl += l.pnl;
        });
        const sorted = Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
        container.innerHTML = sorted.map(([date, stats]) => `
             <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-3 px-4 font-bold text-slate-800">${date}</td>
                <td class="py-3 px-4 text-center text-xs text-slate-500" colspan="3">${stats.count} Events</td>
                <td class="py-3 px-4 text-right font-bold ${stats.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-mono" colspan="3">${currentCurrencySymbol}${stats.pnl.toFixed(0)}</td>
             </tr>`).join('');
    }
}

function renderLogs(recent) {
    const container = document.getElementById('logs-table-body');
    container.innerHTML = recent.map(l => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">${l.date}</td>
            <td class="py-3 px-4 font-bold text-sm text-slate-900">${l.symbol}</td>
            <td class="py-3 px-4 text-xs"><span class="${(l.action.includes('BUY') || l.action.includes('ADD')) ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'} px-2 py-1 rounded-md font-bold tracking-wide">${l.action}</span></td>
            <td class="py-3 px-4 text-sm text-right font-mono text-slate-700">${currentCurrencySymbol}${l.price.toFixed(2)}</td>
            <td class="py-3 px-4 text-sm text-right font-mono text-slate-700">${l.shares.toFixed(0)}</td>
            <td class="py-3 px-4 text-right font-bold font-mono ${l.pnl > 0 ? 'text-emerald-600' : (l.pnl < 0 ? 'text-rose-600' : 'text-slate-400')}">${l.pnl ? (l.pnl > 0 ? '+' : '') + currentCurrencySymbol + l.pnl.toFixed(0) : '-'}</td>
            <td class="py-3 px-4 text-xs text-slate-400 italic">${l.reason}</td>
        </tr>`).join('');
}

function updatePositions(positions, tradeLogs) {
    const container = document.getElementById('positions-table-body');
    if (!container) return;

    const entryDateMap = {};
    if (tradeLogs && tradeLogs.length > 0) {
        tradeLogs.forEach(log => {
            if (log.action && (log.action.includes('BUY') || log.action.includes('ADD') || log.action === 'ENTRY')) {
                if (!entryDateMap[log.symbol]) entryDateMap[log.symbol] = log.date;
            }
        });
    }

    const today = new Date();
    const regionStats = { US: 0, HK: 0, EU: 0, Others: 0 };
    const euSuffixes = ['.PA', '.DE', '.MI', '.L', '.AS', '.MA', '.MC'];

    positions.forEach(p => {
        p.entry_date = entryDateMap[p.symbol] || null;
        if (p.entry_date) {
            const entryDate = new Date(p.entry_date);
            p.days_held = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
        } else {
            p.days_held = null;
        }

        if (p.symbol.endsWith('.HK')) {
            p.region = 'HK'; p.flag = '🇭🇰'; p.currency = 'HK$';
        } else if (euSuffixes.some(s => p.symbol.includes(s))) {
            p.region = 'EU'; p.flag = '🇪🇺'; p.currency = '€';
        } else {
            p.region = 'US'; p.flag = '🇺🇸'; p.currency = '$';
        }
        regionStats[p.region] += p.weight_pct;
    });

    const regionDiv = document.getElementById('region-allocation');
    if (regionDiv) {
        regionDiv.innerHTML = Object.entries(regionStats)
            .filter(([r, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([r, v]) => `
                <span class="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                    <span class="mr-1">${r === 'US' ? '🇺🇸' : (r === 'HK' ? '🇭🇰' : (r === 'EU' ? '🇪🇺' : '🌍'))}</span> ${r} ${v.toFixed(1)}%
                </span>
            `).join('');
    }

    positions.sort((a, b) => b.weight_pct - a.weight_pct);
    container.innerHTML = positions.map(p => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 font-bold text-slate-900">${p.flag} ${p.symbol}</td>
            <td class="py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">${p.asset_class || '-'}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-600">${p.shares.toFixed(0)}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-600">${p.currency}${p.avg_entry.toFixed(2)}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-900 font-bold">${p.currency}${p.current_price.toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-bold ${p.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-mono">€${p.pnl.toFixed(0)} <span class="text-xs ml-1 opacity-80">(${p.pnl_pct > 0 ? '+' : ''}${p.pnl_pct.toFixed(2)}%)</span></td>
            <td class="py-3 px-4 text-right text-sm font-bold text-slate-800">${p.weight_pct.toFixed(1)}%</td>
            <td class="py-3 px-4 text-right text-xs text-slate-500">${p.entry_date || '-'}</td>
            <td class="py-3 px-4 text-right text-xs font-mono text-slate-600">${p.days_held !== null ? p.days_held + 'd' : '-'}</td>
        </tr>`).join('');
}

// New function: Update Pending Orders table (SL/TP/Limit orders)
function updatePendingOrders(positions, opportunities) {
    const container = document.getElementById('pending-orders-body');
    if (!container) return;
    const pendingOrders = [];
    const today = new Date().toISOString().split('T')[0];
    const posMap = {};
    positions.forEach(p => {
        const baseSym = p.symbol.split('.')[0];
        posMap[baseSym] = p; posMap[p.symbol] = p;
    });

    if (opportunities && opportunities.length > 0) {
        opportunities.forEach(op => {
            const sym = op.Signal.Ticker;
            const pos = posMap[sym] || posMap[sym + '.US'] || posMap[sym + '.HK'];
            const isHeld = !!pos;
            if (op.Signal.StopLoss) {
                pendingOrders.push({
                    date: op.Signal.Date.split('T')[0],
                    symbol: sym,
                    type: isHeld ? 'ACTIVE SL' : 'ENTRY SL',
                    typeClass: isHeld ? 'text-rose-700 bg-rose-100 border border-rose-200' : 'text-rose-600 bg-rose-50',
                    price: op.Signal.StopLoss,
                    currency: sym.includes('.HK') ? 'HK$' : (sym.includes('.PA') ? '€' : '$'),
                    shares: isHeld ? pos.shares : Math.round(5000 / op.Signal.Price),
                    triggerPct: (((op.Signal.StopLoss - op.Signal.Price) / op.Signal.Price) * 100).toFixed(1) + '%',
                    status: (isHeld && pos.current_price <= op.Signal.StopLoss) ? 'HIT' : 'MONITORED'
                });
            }
            if (!isHeld) {
                pendingOrders.push({
                    date: op.Signal.Date.split('T')[0],
                    symbol: sym,
                    type: 'LIMIT BUY',
                    typeClass: 'text-indigo-600 bg-indigo-50 border border-indigo-100',
                    price: op.Signal.Price,
                    currency: sym.includes('.HK') ? 'HK$' : '$',
                    shares: Math.round(5000 / op.Signal.Price),
                    triggerPct: 'BREAKOUT',
                    status: 'PENDING'
                });
            }
        });
    }

    positions.forEach(p => {
        const baseSym = p.symbol.split('.')[0];
        const hasOps = opportunities.some(op => op.Signal.Ticker === baseSym || op.Signal.Ticker === p.symbol);
        if (!hasOps) {
            pendingOrders.push({ date: today, symbol: p.symbol, type: 'TRAILING SL', typeClass: 'text-amber-600 bg-amber-50', price: p.avg_entry * 0.92, currency: p.currency || '$', shares: p.shares, triggerPct: '-8.0%', status: 'ACTIVE' });
        }
        pendingOrders.push({ date: today, symbol: p.symbol, type: 'TARGET TP', typeClass: 'text-emerald-700 bg-emerald-50', price: p.avg_entry * 1.25, currency: p.currency || '$', shares: Math.floor(p.shares * 0.5), triggerPct: '+25.0%', status: 'PENDING' });
    });

    pendingOrders.sort((a, b) => a.type.localeCompare(b.type));
    container.innerHTML = pendingOrders.slice(0, 15).map(o => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-2 px-3 text-[10px] text-slate-400">${o.date}</td>
            <td class="py-2 px-3 font-bold text-slate-900">${o.symbol}</td>
            <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${o.typeClass}">${o.type}</span></td>
            <td class="py-2 px-3 text-right font-mono text-xs">${o.currency}${o.price.toFixed(2)}</td>
            <td class="py-2 px-3 text-right font-mono text-xs text-slate-500">${o.shares}</td>
            <td class="py-2 px-3 text-center text-xs font-bold ${o.triggerPct.startsWith('-') ? 'text-rose-500' : 'text-emerald-500'}">${o.triggerPct}</td>
            <td class="py-2 px-3 text-center"><span class="px-2 py-0.5 rounded text-[9px] font-bold ${o.status === 'HIT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'}">${o.status}</span></td>
        </tr>`).join('');
}

function updateTimeline(events) {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    const recent = events.slice().reverse();
    const colorMap = {
        'emerald': { dot: 'bg-emerald-500', line: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
        'amber': { dot: 'bg-amber-500', line: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
        'rose': { dot: 'bg-rose-500', line: 'border-rose-200', badge: 'bg-rose-100 text-rose-800' },
        'zinc': { dot: 'bg-slate-400', line: 'border-slate-200', badge: 'bg-slate-100 text-slate-600' }
    };
    container.innerHTML = recent.map(e => {
        const c = colorMap[e.color] || colorMap['zinc'];
        return `
        <div class="relative pl-8 pb-8 border-l-2 ${c.line} last:border-0 last:pb-0">
            <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full ${c.dot} ring-4 ring-white"></div>
            <div class="mb-1 text-sm font-bold text-slate-500 flex items-center gap-2">
                ${e.date} <span class="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${c.badge}">${e.type}</span>
            </div>
            <div class="text-slate-800 font-medium">${e.message}</div>
        </div>`;
    }).join('');
}

// Store global data for event filtering
let globalSystemEvents = [];
let globalTradeLogs = [];

function updateCalendarView(data) {
    const container = document.getElementById('calendar-view');
    if (!container) return;
    const curve = data.equity_curve;
    if (!curve || curve.length === 0) return;

    globalSystemEvents = data.system_events || [];
    globalTradeLogs = data.trade_logs || [];

    const eventMap = {};
    globalSystemEvents.forEach(e => {
        if (!eventMap[e.date]) eventMap[e.date] = [];
        eventMap[e.date].push(e);
    });
    const stopMap = {};
    globalTradeLogs.forEach(l => {
        if (l.action === 'STOP') {
            if (!stopMap[l.date]) stopMap[l.date] = 0;
            stopMap[l.date]++;
        }
    });

    const monthGroups = {};
    let currentRegime = 'NEUTRAL';
    const regimeColor = { 'BULL': 'bg-emerald-100 hover:bg-emerald-200', 'BEAR': 'bg-rose-100 hover:bg-rose-200', 'NEUTRAL': 'bg-gray-100 hover:bg-gray-200' };
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    curve.forEach(p => {
        const d = p.date;
        const [year, month] = d.split('-');
        const key = `${year}-${month}`;
        if (!monthGroups[key]) monthGroups[key] = [];
        if (eventMap[d]) {
            eventMap[d].forEach(e => {
                if (e.type === 'REGIME' || e.message.includes('Regime')) {
                    if (e.message.includes('Bull')) currentRegime = 'BULL';
                    else if (e.message.includes('Bear')) currentRegime = 'BEAR';
                    else currentRegime = 'NEUTRAL';
                }
            });
        }
        monthGroups[key].push({ date: d, day: parseInt(d.split('-')[2]), regime: currentRegime, stops: stopMap[d] || 0, events: eventMap[d] || [] });
    });

    const sortedKeys = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a)).slice(0, 12);
    let html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    sortedKeys.forEach(key => {
        const [year, month] = key.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        html += `<div class="bg-white rounded-lg p-3 shadow-sm border"><h5 class="font-bold text-sm text-slate-700 mb-2 text-center">${monthName} ${year}</h5><div class="grid grid-cols-7 gap-1">`;
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => { html += `<div class="text-[9px] text-slate-400 font-bold text-center">${d}</div>`; });
        const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay();
        for (let i = 0; i < firstDay; i++) html += '<div class="h-6"></div>';
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const dayData = {}; monthGroups[key].forEach(p => { dayData[p.day] = p; });
        for (let day = 1; day <= daysInMonth; day++) {
            const p = dayData[day];
            if (p) {
                let cls = regimeColor[p.regime] || 'bg-gray-100';
                let ring = p.stops > 0 ? 'ring-1 ring-rose-400' : '';
                let isPanic = p.events.some(e => e.type === 'PANIC' || e.message.includes('LIQUIDATE'));
                if (isPanic) cls = 'bg-slate-800 text-white hover:bg-slate-700';
                let dot = p.events.length > 0 ? '<span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500"></span>' : '';
                html += `<div onclick="showDayEvents('${p.date}')" class="${cls} ${ring} rounded h-6 flex items-center justify-center text-[10px] cursor-pointer relative transition-all">${day}${dot}</div>`;
            } else {
                html += `<div class="bg-slate-50 rounded h-6 flex items-center justify-center text-[10px] text-slate-300">${day}</div>`;
            }
        }
        html += '</div></div>';
    });
    html += '</div><div class="mt-3 text-xs text-slate-400 flex flex-wrap gap-3 justify-center"><span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-emerald-100"></span>Bull</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-rose-100"></span>Bear</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-slate-800"></span>Panic</span><span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Event</span></div>';
    container.innerHTML = html;
}

window.showDayEvents = function (dateStr) {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    const events = globalSystemEvents.filter(e => e.date === dateStr);
    const trades = globalTradeLogs.filter(l => l.date === dateStr);
    if (events.length === 0 && trades.length === 0) { container.innerHTML = `<div class="text-center text-slate-400 py-4">No events on ${dateStr}</div>`; return; }
    let html = `<div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200"><strong class="text-blue-800">Events for ${dateStr}</strong></div>`;
    events.forEach(e => {
        const c = e.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' : (e.color === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800');
        html += `<div class="p-3 rounded-lg ${c} mb-2"><span class="text-xs font-bold uppercase">${e.type}</span><div class="font-medium mt-1">${e.message}</div></div>`;
    });
    if (trades.length > 0) {
        html += '<div class="mt-4"><h4 class="font-bold text-sm text-slate-600 mb-2">Trades:</h4>';
        trades.forEach(t => {
            const ac = (t.action.includes('BUY') || t.action.includes('ADD')) ? 'text-emerald-600' : 'text-rose-600';
            html += `<div class="flex justify-between items-center p-2 bg-slate-50 rounded mb-1"><span class="font-bold">${t.symbol}</span><span class="${ac} font-bold text-sm">${t.action}</span><span class="font-mono text-sm">${currentCurrencySymbol}${t.price.toFixed(2)}</span>${t.pnl ? `<span class="${t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold">${t.pnl >= 0 ? '+' : ''}${currentCurrencySymbol}${t.pnl.toFixed(0)}</span>` : ''}</div>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth' });
}

function updateMonthlyHeatmap(data) {
    const container = document.getElementById('monthly-heatmap-body');
    if (!container) return;
    const curve = data.equity_curve;
    if (!curve || curve.length === 0) return;
    const pointsByMonth = {};
    const years = [];
    const matrix = {};
    curve.forEach(p => {
        const d = new Date(p.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${m.toString().padStart(2, '0')}`;
        if (!matrix[y]) { matrix[y] = {}; years.push(y); }
        pointsByMonth[key] = p.equity;
    });
    years.sort((a, b) => b - a);
    let html = '';
    years.forEach(y => {
        let rowHtml = `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-2 text-left font-bold text-slate-700">${y}</td>`;
        for (let m = 1; m <= 12; m++) {
            const currentKey = `${y}-${m.toString().padStart(2, '0')}`;
            let prevKey;
            if (m === 1) prevKey = `${y - 1}-12`;
            else prevKey = `${y}-${(m - 1).toString().padStart(2, '0')}`;
            const currEq = pointsByMonth[currentKey];
            let prevEq = pointsByMonth[prevKey];
            if (!prevEq && m === 1) {
                const firstDate = new Date(curve[0].date);
                if (firstDate.getFullYear() === y && firstDate.getMonth() + 1 === m) prevEq = curve[0].equity;
            }
            if (currEq && prevEq) {
                const ret = (currEq - prevEq) / prevEq;
                const color = ret >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
                rowHtml += `<td class="p-2"><div class="rounded py-1 ${color} font-mono text-xs font-bold">${(ret * 100).toFixed(1)}%</div></td>`;
            } else {
                rowHtml += `<td class="p-2 text-slate-300">-</td>`;
            }
        }
        const months = Object.keys(pointsByMonth).filter(k => k.startsWith(y));
        if (months.length > 0) {
            months.sort();
            const firstM = months[0];
            const lastM = months[months.length - 1];
            let startEq;
            const fmParts = firstM.split('-');
            const fmMonth = parseInt(fmParts[1]);
            if (fmMonth === 1) startEq = pointsByMonth[`${y - 1}-12`];
            else startEq = pointsByMonth[`${y}-${(fmMonth - 1).toString().padStart(2, '0')}`];
            if (!startEq && months.length > 0) {
                const firstPt = curve.find(p => p.date.startsWith(y));
                if (firstPt) startEq = firstPt.equity;
            }
            const endEq = pointsByMonth[lastM];
            if (startEq && endEq) {
                const yRet = (endEq - startEq) / startEq;
                const yColor = yRet >= 0 ? 'text-emerald-600' : 'text-rose-600';
                rowHtml = rowHtml.replace('</td>', '</td>' + `<td class="p-2 font-bold ${yColor}">${(yRet * 100).toFixed(1)}%</td>`);
            } else {
                rowHtml = rowHtml.replace('</td>', '</td><td class="p-2">-</td>');
            }
        } else {
            rowHtml = rowHtml.replace('</td>', '</td><td class="p-2">-</td>');
        }
        rowHtml += '</tr>';
        html += rowHtml;
    });
    container.innerHTML = html;
}

let timeAllocChartInstanceLast = null;
function updateTimeAllocationChart(alloc) {
    const ctx = document.getElementById('timeAllocationChart');
    if (!ctx) return;
    if (window.timeAllocChartInstance) window.timeAllocChartInstance.destroy();

    const labels = Object.keys(alloc);
    const data = Object.values(alloc);
    const colors = {
        "Crypto & Proxies": "#f59e0b",
        "Precious Metals": "#eab308",
        "Technology & AI": "#3b82f6",
        "Energy & Uranium": "#10b981",
        "Other Strategies": "#6366f1",
        "Cash": "#94a3b8"
    };
    const bgColors = labels.map(l => colors[l] || "#cbd5e1");

    window.timeAllocChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: (c) => ' ' + c.label + ': ' + c.parsed.toFixed(1) + '%' } }
            }
        }
    });
}

function updateEduStats(data) {
    const curve = data.equity_curve;
    if (!curve || curve.length < 2) return;
    let returns = [];
    for (let i = 1; i < curve.length; i++) {
        const r = (curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity;
        returns.push(r);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const dailyVaR95 = 1.65 * stdDev;
    const s = data.stats;
    const elSharpe = document.getElementById('edu-sharpe');
    const elSharpeV = document.getElementById('verdict-sharpe');
    if (elSharpe && s.sharpe_ratio) {
        const sr = s.sharpe_ratio;
        elSharpe.textContent = sr.toFixed(2);
        if (sr > 2) elSharpeV.textContent = "🚀 Exceptionnel (Top 1%)";
        else if (sr > 1.5) elSharpeV.textContent = "🏆 Excellent (Top 10%)";
        else if (sr > 1.0) elSharpeV.textContent = "✅ Solide";
        else elSharpeV.textContent = "⚠️ À améliorer";
    }
    const elWR = document.getElementById('edu-winrate');
    const elWRV = document.getElementById('verdict-winrate');
    if (elWR && s.win_rate_pct) {
        const wr = s.win_rate_pct;
        elWR.textContent = wr.toFixed(1) + '%';
        if (wr > 65) elWRV.textContent = "👑 God Mode";
        else if (wr > 55) elWRV.textContent = "✅ Pro Standard";
        else if (wr > 50) elWRV.textContent = "👌 Correct";
        else elWRV.textContent = "🎲 Casino";
    }
    const elDD = document.getElementById('edu-dd');
    const elDDV = document.getElementById('verdict-dd');
    if (elDD && s.max_drawdown_pct) {
        const dd = s.max_drawdown_pct;
        elDD.textContent = dd.toFixed(1) + '%';
        if (dd > -10) elDDV.textContent = "🛡️ Forteresse";
        else if (dd > -20) elDDV.textContent = "✅ Normal";
        else elDDV.textContent = "⚠️ Risqué";
    }
    const elVaR = document.getElementById('edu-var');
    if (elVaR) elVaR.textContent = "-" + (dailyVaR95 * 100).toFixed(2) + "%";

    if (data.stats && data.stats.current_positions) {
        const tactical = calculateTacticalAllocation(data.stats.current_positions, data.stats.cash_pct || 2.0);
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val || 0).toFixed(1) + '%'; };
        setTxt('alloc-crypto', tactical['Crypto & Proxies']);
        setTxt('alloc-tech', tactical['Technology & AI']);
        setTxt('alloc-gold', tactical['Precious Metals']);
        setTxt('alloc-cash', tactical['Cash']);
    }
}
