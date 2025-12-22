
let equityChartInstance = null;
let currentCurrencyRate = 1.0; // Default USD
let currentCurrencySymbol = "$";

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
        const response = await fetch(`../../common/data/portfolio_${period}.json`);
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
