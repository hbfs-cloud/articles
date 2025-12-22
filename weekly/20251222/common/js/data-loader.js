
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
        updateChart(data.equity_curve);
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

function updateChart(curveData) {
    const ctx = document.getElementById('equityCurveChart');
    if (!ctx) return;

    const dates = curveData.map(d => d.date);
    const values = curveData.map(d => d.equity);

    if (equityChartInstance) {
        equityChartInstance.destroy();
    }

    // Determine color based on trend (last > first)
    const isPositive = values[values.length - 1] >= values[0];
    const color = isPositive ? '#2563eb' : '#dc2626'; // Blue or Red
    const bgColor = isPositive ? 'rgba(37, 99, 235, 0.1)' : 'rgba(220, 38, 38, 0.1)';

    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Portfolio Equity',
                data: values,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return ' €' + context.parsed.y.toLocaleString();
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
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6 }
                },
                y: {
                    display: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: function (value) {
                            return '€' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}
window.loadData = loadPeriod;
