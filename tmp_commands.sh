# First, check what articles command is available
ls -la ~/.npm-global/bin/ | grep -i article
ls -la ~/.npm-global/lib/node_modules/ | grep -i article

# Check for local articles.js or index.js
find /home/ci/projects/articles -name "*.js" -type f | xargs grep -l "scan du jour" 2>/dev/null

# Check package.json for scripts
grep -n "scan" /home/ci/projects/articles/package.json 2>/dev/null