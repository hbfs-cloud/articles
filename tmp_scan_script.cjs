// Run the screener with the appropriate configuration
const { run } = require('./mcp/server/lib/screener.js');
const fs = require('fs');
const path = require('path');

async function runAutoScreener() {
    const SCAN_DATE = process.env.SCAN_DATE || '20260403';
    console.log(`Running screener for date: ${SCAN_DATE}`);
    
    // Define the scanner configuration
    const config = {
        universe: 'us_large',
        filter: 'change1d > 2.0 AND volume > avgvol3m * 1.5 AND price > ema50',
        limit: 20,
        bars: true,
        sort: 'score'
    };
    
    try {
        const result = await run(config);
        
        // Format HTML output
        const html = generateHTML(result, SCAN_DATE);
        
        // Ensure output directory exists
        const outDir = path.join(__dirname, 'scanner', SCAN_DATE);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        
        // Write HTML file
        const outPath = path.join(outDir, 'index.html');
        fs.writeFileSync(outPath, html);
        
        console.log(`Generated ${outPath} (${html.length} bytes)`);
        
        // Call add_card.js to index the scan
        try {
            const { execSync } = require('child_process');
            execSync(`node tools/add_card.js`, { stdio: 'inherit' });
        } catch (error) {
            console.error('Error running add_card.js:', error.message);
        }
        
    } catch (error) {
        console.error('Error running screener:', error);
        process.exit(1);
    }
}

function generateHTML(result, scanDate) {
    const picks = result.picks || [];
    const meta = result.meta || {};
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DailyTickers Scanner - ${scanDate}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .date { font-size: 24px; color: #666; }
        .scount { font-size: 18px; color: #444; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: 600; }
        .positive { color: green; font-weight: bold; }
        .negative { color: red; font-weight: bold; }
        .momentum { background-color: #e6f7ff; }
        .breakout { background-color: #f0f9ff; }
        .pullback { background-color: #f0fff4; }
        .prequeeze { background-color: #faf5ff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📈 DailyTickers Scanner</h1>
        <div class="date">${scanDate}</div>
        <div class="scount">${picks.length} stocks matching scanner criteria</div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Score</th>
                <th>Strategy</th>
            </tr>
        </thead>
        <tbody>
            ${picks.map(pick => `
            <tr class="${pick.strategy || 'momentum'}">
                <td><strong>${pick.symbol}</strong></td>
                <td>${pick.name}</td>
                <td>$${pick.price ? pick.price.toFixed(2) : 'N/A'}</td>
                <td class="${pick.changePct >= 0 ? 'positive' : 'negative'}">${pick.changePct ? pick.changePct.toFixed(2) + '%' : 'N/A'}</td>
                <td>${pick.volume ? (pick.volume / 1000000).toFixed(2) + 'M' : 'N/A'}</td>
                <td>${pick.score || 0}</td>
                <td>${pick.strategy || 'Momentum'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div style="margin-top: 40px; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
        <h3>Scanner Metadata</h3>
        <pre>${JSON.stringify(meta, null, 2)}</pre>
    </div>
</body>
</html>`;
}

// Run if called directly
if (require.main === module) {
    runAutoScreener();
}

module.exports = { runAutoScreener };