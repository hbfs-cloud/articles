const fs = require('fs');
const results = JSON.parse(fs.readFileSync('data/backtest-results.json'));

const findBest = (title, targetReturn, targetDD, targetR2, minTrades) => {
  console.log(`\n🔍 Searching for ${title} candidates...`);
  const candidates = results.top20_composite.filter(r => 
    r.returnTotal >= targetReturn && 
    Math.abs(r.maxDD) <= targetDD && 
    r.r2 >= targetR2 &&
    r.trades >= minTrades
  );
  
  if (candidates.length === 0) {
    console.log(`❌ No perfect matches in top20_composite. Loosening DD by 1%...`);
    const relaxed = results.top20_composite.filter(r => 
      r.returnTotal >= targetReturn && 
      Math.abs(r.maxDD) <= targetDD + 1 && 
      r.r2 >= targetR2 - 0.1 &&
      r.trades >= minTrades
    ).sort((a,b) => b.returnTotal - a.returnTotal);
    
    relaxed.slice(0, 3).forEach(c => console.log(JSON.stringify(c, null, 2)));
  } else {
    candidates.sort((a,b) => b.returnTotal - a.returnTotal).slice(0, 3).forEach(c => console.log(JSON.stringify(c, null, 2)));
  }
};

findBest("DYNAMIC", 35, 6, 0.8, 12);
findBest("BALANCED", 25, 4, 0.8, 12);
findBest("SECURED", 15, 2, 0.8, 12);
