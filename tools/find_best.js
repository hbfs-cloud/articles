const fs = require('fs');
const path = require('path');
const sweep = fs.readFileSync('tools/sweep.js', 'utf8');

// Extract the logic needed to run a fast search
// But it's easier to just modify tools/sweep.js's QUICK parameters and run it!
