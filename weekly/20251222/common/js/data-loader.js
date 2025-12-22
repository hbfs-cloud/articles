
let equityChartInstance = null;
let currentCurrencyRate = 1.0; // Default USD
let currentCurrencySymbol = "€";

document.addEventListener('DOMContentLoaded', () => {
    // Load default period (1Y)
    loadPeriod('1y');

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

            const period = e.target.getAttribute('data-period');
            loadPeriod(period);
        });
    });
});

async function loadPeriod(period) {
    try {
        const response = await fetch(`../../common/data/portfolio_${period}.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error("Data not found");

        const data = await response.json();

        updateStats(data.stats);
        updateChart(data);
        if (data.benchmark_drawdowns) updateDrawdownChart(data);

        if (data.trade_logs) updateLogs(data.trade_logs);
        if (data.stats && data.stats.current_positions) updatePositions(data.stats.current_positions);
        if (data.system_events) updateTimeline(data.system_events);
        updateMonthlyHeatmap(data);
        if (data.stats.avg_allocation) updateTimeAllocationChart(data.stats.avg_allocation);
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
            if (colorClass) {
                el.className = colorClass; // Reset class and add new
            }
        }
    };

    updateElement('stat-total-return', (stats.total_return_pct >= 0 ? '+' : '') + stats.total_return_pct.toFixed(1) + '%');
    updateElement('stat-cagr', stats.cagr_pct ? stats.cagr_pct.toFixed(1) + '%' : 'N/A');
    updateElement('stat-sharpe', stats.sharpe_ratio.toFixed(2));
    updateElement('stat-max-dd', '-' + Math.abs(stats.max_dd_pct).toFixed(1) + '%');

    // Update balance if needed
    if (document.getElementById('stat-balance')) {
        document.getElementById('stat-balance').innerText = '€' + Math.round(stats.final_balance).toLocaleString();
    }

    // New Advanced Stats
    if (stats.win_rate_pct !== undefined) updateElement('stat-winrate', stats.win_rate_pct.toFixed(1) + '%');
    if (stats.profit_factor !== undefined) updateElement('stat-profitfactor', stats.profit_factor.toFixed(2));
    if (stats.max_trade_win !== undefined) updateElement('stat-maxwin', '+' + currentCurrencySymbol + stats.max_trade_win.toFixed(0), 'text-green-600 font-bold');
    if (stats.max_trade_loss !== undefined) updateElement('stat-maxloss', currentCurrencySymbol + stats.max_trade_loss.toFixed(0), 'text-red-600 font-bold');

    // Update Risk Metrics
    if (stats.risk_metrics) {
        updateElement('stat-var99', '-' + Math.abs(stats.risk_metrics.var_99_monte_carlo_pct).toFixed(2) + '%'); // Display as negative loss
        updateElement('stat-beta', stats.risk_metrics.beta.toFixed(2));
        if (stats.risk_metrics.greeks) {
            updateElement('stat-vega', stats.risk_metrics.greeks.vega.toFixed(2));
        }

        // Update Max Pain List
        const mpList = document.getElementById('list-maxpain');
        if (mpList && stats.risk_metrics.max_pain_list) {
            mpList.innerHTML = stats.risk_metrics.max_pain_list.slice(0, 5).map(p => {
                const pnlClass = p.pnl_pct >= 0 ? '#16a34a' : '#dc2626'; // Green / Red hex
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
        } else {
            // Fallback for old data structure
            updateElement('stat-maxpain', '$' + (stats.risk_metrics.max_pain_spy || 0).toFixed(0));
        }
    }

    // Update Event Calendar
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

    // Update Radar Chart
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
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        ticks: { display: false, backdropColor: 'transparent' },
                        grid: { color: '#e2e8f0' },
                        angleLines: { color: '#e2e8f0' },
                        suggestedMin: 0
                    }
                }
            }
        });

        // Update Regions
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

    // Update Benchmarks & Stability
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
            const inflation = { sym: 'Inflation (CPI)', ret: 2.5, vol: 1.2 };

            const list = refs.map(sym => {
                const d = stats.benchmarks[sym];
                return d ? { sym, ret: d.return_pct, vol: d.volatility_pct } : null;
            }).filter(x => x);
            list.push(inflation);

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
    const values = curveData.map(d => d.equity);

    if (equityChartInstance) {
        equityChartInstance.destroy();
    }

    // Main Portfolio Dataset
    const datasets = [{
        label: 'Portfolio Equity',
        data: values,
        borderColor: '#2563eb', // Blue
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1
    }];

    // Add Benchmarks from data.benchmarks
    if (data.benchmarks) {
        const colors = {
            'SPY': '#f97316', // Orange
            'GLD': '#eab308', // Yellow
            'DIA': '#475569', // Slate
            'IWM': '#9333ea', // Purple
            'SI=F': '#9ca3af', // Gray (Silver)
            'BTC-USD': '#f59e0b' // Amber
        };
        const labels = {
            'SPY': 'S&P 500', 'GLD': 'Gold', 'DIA': 'Dow Jones', 'IWM': 'Russell 2000', 'SI=F': 'Silver', 'BTC-USD': 'Bitcoin'
        };

        // Order: SPY, Gold, Dow, Russell, Silver
        const priority = ['SPY', 'GLD', 'DIA', 'IWM', 'SI=F'];

        priority.forEach(sym => {
            if (data.benchmarks[sym]) {
                datasets.push({
                    label: labels[sym] || sym,
                    data: data.benchmarks[sym],
                    borderColor: colors[sym] || '#000',
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    tension: 0.1,
                    borderDash: sym === 'SPY' || sym === 'GLD' ? [] : [5, 5] // Dashed for less important ones
                });
            }
        });
    }

    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + currentCurrencySymbol + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: {
                    display: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { callback: function (value) { return currentCurrencySymbol + value.toLocaleString(); } }
                }
            }
        }
    });
}

let drawdownChartInstance = null;
function updateDrawdownChart(data) {
    const ctx = document.getElementById('drawdownComparisonChart');
    if (!ctx) return;

    // Dates from internal system
    const dates = data.equity_curve.map(d => d.date);

    // Benchmark DDs
    const datasets = [];

    // Portfolio DD (Negative %)
    const portDD = data.equity_curve.map(d => -Math.abs(d.dd * 100)); // Ensure negative
    datasets.push({
        label: 'Portfolio DD',
        data: portDD,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0
    });

    // Benchmarks
    if (data.benchmark_drawdowns) {
        const colors = {
            'SPY': '#f97316', 'GLD': '#eab308', 'DIA': '#475569', 'IWM': '#9333ea', 'SI=F': '#9ca3af'
        };
        const priority = ['SPY', 'GLD', 'DIA', 'IWM', 'SI=F'];
        priority.forEach(sym => {
            if (data.benchmark_drawdowns[sym]) {
                datasets.push({
                    label: sym,
                    data: data.benchmark_drawdowns[sym].map(v => -Math.abs(v * 100)),
                    borderColor: colors[sym] || '#000',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0,
                    borderDash: [2, 2]
                });
            }
        });
    }

    if (drawdownChartInstance) drawdownChartInstance.destroy();

    drawdownChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 9 } } },
                tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + '%' } }
            },
            scales: {
                x: { display: false },
                y: { display: true, min: -35, max: 0, grid: { color: '#f1f5f9' }, ticks: { callback: (v) => v + '%' } }
            }
        }
    });
}

function updateLogs(logs) {
    const container = document.getElementById('logs-table-body');
    if (!container) return;

    // Sort by date desc (assuming logs are chronological append)
    const recent = logs.slice().reverse().slice(0, 100);

    container.innerHTML = recent.map(l => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">${l.date}</td>
            <td class="py-3 px-4 font-bold text-sm text-slate-900">${l.symbol}</td>
            <td class="py-3 px-4 text-xs"><span class="${(l.action.includes('BUY') || l.action.includes('ADD')) ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'} px-2 py-1 rounded-md font-bold tracking-wide">${l.action}</span></td>
            <td class="py-3 px-4 text-sm text-right font-mono text-slate-700">${currentCurrencySymbol}${l.price.toFixed(2)}</td>
            <td class="py-3 px-4 text-sm text-right font-mono text-slate-700">${l.shares.toFixed(0)}</td>
            <td class="py-3 px-4 text-right font-bold font-mono ${l.pnl > 0 ? 'text-emerald-600' : (l.pnl < 0 ? 'text-rose-600' : 'text-slate-400')}">${l.pnl ? (l.pnl > 0 ? '+' : '') + currentCurrencySymbol + l.pnl.toFixed(0) : '-'}</td>
            <td class="py-3 px-4 text-xs text-slate-400 italic">${l.reason}</td>
        </tr>
    `).join('');
}

function updatePositions(positions) {
    const container = document.getElementById('positions-table-body');
    if (!container) return;

    positions.sort((a, b) => b.weight_pct - a.weight_pct);

    container.innerHTML = positions.map(p => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 font-bold text-slate-900">${p.symbol}</td>
            <td class="py-3 px-4 text-xs text-slate-500 uppercase tracking-wider">${p.asset_class}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-600">${p.shares.toFixed(0)}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-600">${currentCurrencySymbol}${p.avg_entry.toFixed(2)}</td>
            <td class="py-3 px-4 text-right text-sm font-mono text-slate-900 font-bold">${currentCurrencySymbol}${p.current_price.toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-bold ${p.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-mono">${currentCurrencySymbol}${p.pnl.toFixed(0)} <span class="text-xs ml-1 opacity-80">(${p.pnl_pct > 0 ? '+' : ''}${p.pnl_pct.toFixed(2)}%)</span></td>
            <td class="py-3 px-4 text-right text-sm font-bold text-slate-800">${p.weight_pct.toFixed(1)}%</td>
        </tr>
    `).join('');
}

function updateTimeline(events) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // Sort recent first
    const recent = events.slice().reverse();

    // Color Mapping for Tailwind (Safe listing)
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
                ${e.date} 
                <span class="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${c.badge}">${e.type}</span>
            </div>
            <div class="text-slate-800 font-medium">${e.message}</div>
        </div>
        `;
    }).join('');
}

function updateMonthlyHeatmap(data) {
    const container = document.getElementById('monthly-heatmap-body');
    if (!container) return;

    const curve = data.equity_curve;
    if (!curve || curve.length === 0) return;

    // Calculate Monthly Returns
    const monthlyRets = {}; // { '2023-01': 0.05, ... }
    const yearRets = {};    // { '2023': 0.15, ... }

    // We need End of Month prices.
    // Map: Year -> { Jan: val, Feb: val ... Total: val }
    const matrix = {};
    const years = [];

    // Index by YYYY-MM
    let lastEq = curve[0].equity; // Start equity
    // Actually we need to find the equity at the end of each month
    // Iterate points
    const pointsByMonth = {};

    curve.forEach(p => {
        const d = new Date(p.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1; // 1-12
        const key = `${y}-${m.toString().padStart(2, '0')}`;

        if (!matrix[y]) { matrix[y] = {}; years.push(y); }

        // Keep updating to find last point of month
        pointsByMonth[key] = p.equity;
    });

    years.sort((a, b) => b - a); // Descending

    // Calculate returns
    // Ret_M = (Eq_End_M - Eq_End_PrevM) / Eq_End_PrevM
    // We need Eq_End_PrevM.
    // For 2023-01, prev is 2022-12. If not exists, use start of current month?
    // Use curve scan.

    // Better Approach:
    // Iterate years, then months 1-12.
    // Find End Equity of this month.
    // Find End Equity of previous month (or start of data).

    let html = '';

    years.forEach(y => {
        let rowHtml = `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-2 text-left font-bold text-slate-700">${y}</td>`;

        let yearStartEq = 0;
        let yearEndEq = 0;

        // Find EOY and SOY (approx)
        const lastMonthKey = `${y}-12`;
        // Actually simple sum of monthly rets is approx, but compounding is correct.
        // Let's use stored monthly points.

        // Total Year Return can be taken from Stats if available, or calculated.

        // Loop months
        for (let m = 1; m <= 12; m++) {
            const currentKey = `${y}-${m.toString().padStart(2, '0')}`;

            // Find Prev Key
            let prevKey;
            if (m === 1) {
                prevKey = `${y - 1}-12`;
            } else {
                prevKey = `${y}-${(m - 1).toString().padStart(2, '0')}`;
            }

            const currEq = pointsByMonth[currentKey];
            let prevEq = pointsByMonth[prevKey];

            // Boundary condition: start of dataset
            if (!prevEq && m === 1) {
                // If this is the very first year, try to find start equity
                // For now, if no prevEq, we can't calc (or skip).
                // But usually we have context.
                // Check if curve starts before this month.
                const firstDate = new Date(curve[0].date);
                if (firstDate.getFullYear() === y && firstDate.getMonth() + 1 === m) {
                    prevEq = curve[0].equity; // Use very first point
                }
            }

            if (currEq && prevEq) {
                const ret = (currEq - prevEq) / prevEq;
                const color = ret >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
                rowHtml += `<td class="p-2"><div class="rounded py-1 ${color} font-mono text-xs font-bold">${(ret * 100).toFixed(1)}%</div></td>`;
            } else {
                rowHtml += `<td class="p-2 text-slate-300">-</td>`;
            }
        }

        // Year Total
        // If we have stats.annual_returns[y], use it.
        // Else calc from first/last of year.
        const firstM = Object.keys(pointsByMonth).filter(k => k.startsWith(y + '-')).sort()[0];
        const lastM = Object.keys(pointsByMonth).filter(k => k.startsWith(y + '-')).sort().reverse()[0];

        if (firstM && lastM) {
            // We need PREV of firstM to get correct year start.
            // Or use first point of year?
            // Simplest: use data from `pointsByMonth`.
            // But strictly: Year Ret = (Last_Dec - Prev_Dec)/Prev_Dec.
            const prevYKey = `${y - 1}-12`;
            let startY = pointsByMonth[prevYKey];
            const endY = pointsByMonth[lastM];

            if (!startY) {
                // Check if start of dataset
                const firstDate = new Date(curve[0].date);
                if (firstDate.getFullYear() === y) startY = curve[0].equity;
            }

            if (startY && endY) {
                const yRet = (endY - startY) / startY;
                const yColor = yRet >= 0 ? 'text-emerald-600' : 'text-rose-600';
                // Insert After Year Label? No, table structure is: Year | Total | Jan...
                // I put Year Label first.
                // Now I add Total column.
                // Wait, I appended months already. I should PREPEND Total column after Year.
                // Re-construct string.

                const totalCell = `<td class="p-2 font-bold ${yColor}">${(yRet * 100).toFixed(1)}%</td>`;
                // Insert after first </td>
                rowHtml = rowHtml.replace('</td>', '</td>' + totalCell);
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

let timeAllocChartInstance = null;
function updateTimeAllocationChart(alloc) {
    const ctx = document.getElementById('timeAllocationChart');
    if (!ctx) return;

    if (timeAllocChartInstance) timeAllocChartInstance.destroy();

    // Data handling
    const labels = Object.keys(alloc);
    const data = Object.values(alloc);

    // Custom Colors
    const colors = {
        "Cash": "#94a3b8", // Slate 400
        "Stock": "#3b82f6", // Blue 500
        "ETF": "#6366f1",   // Indigo 500
        "Crypto": "#f59e0b", // Amber 500
        "Gold+Silver": "#eab308" // Yellow 500
    };
    const bgColors = labels.map(l => colors[l] || "#cbd5e1");

    timeAllocChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: {
                    callbacks: { label: function (c) { return ' ' + c.label + ': ' + c.parsed.toFixed(1) + '%'; } }
                }
            }
        }
    });
}

function updateEduStats(data) {
    // 1. Calculate Volatility & VaR from Equity Curve
    const curve = data.equity_curve;
    if (!curve || curve.length < 2) return;

    let returns = [];
    for (let i = 1; i < curve.length; i++) {
        const r = (curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity;
        returns.push(r);
    }

    // Mean
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    // Variance/Std
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const dailyVaR95 = 1.65 * stdDev;

    // Update UI
    const s = data.stats;

    // Sharpe
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

    // Winrate
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

    // Drawdown
    const elDD = document.getElementById('edu-dd');
    const elDDV = document.getElementById('verdict-dd');
    if (elDD && s.max_drawdown_pct) {
        const dd = s.max_drawdown_pct; // usually negative
        elDD.textContent = dd.toFixed(1) + '%';
        if (dd > -10) elDDV.textContent = "🛡️ Forteresse";
        else if (dd > -20) elDDV.textContent = "✅ Normal";
        else elDDV.textContent = "⚠️ Risqué";
    }

    // VaR
    const elVaR = document.getElementById('edu-var');
    if (elVaR) {
        elVaR.textContent = "-" + (dailyVaR95 * 100).toFixed(2) + "%";
    }

    // Allocations (Approximation based on avg_allocation if avail)
    // We update table IDs: alloc-crypto, alloc-tech, alloc-gold, alloc-cash
    if (s.avg_allocation) {
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ? val.toFixed(1) + '%' : '0%';
        };
        setTxt('alloc-crypto', s.avg_allocation['Crypto']);
        setTxt('alloc-tech', (s.avg_allocation['Stock'] || 0) + (s.avg_allocation['ETF'] || 0)); // Approx Tech as Stock+ETF
        setTxt('alloc-gold', s.avg_allocation['Gold+Silver']);
        setTxt('alloc-cash', s.avg_allocation['Cash']);
    }
}

window.loadData = loadPeriod;
