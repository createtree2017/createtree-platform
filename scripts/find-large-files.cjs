const fs = require('fs');
const path = require('path');

function countLines(dir) {
    let results = [];
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (!['node_modules', '.git', 'dist', 'build', '.gemini'].includes(file)) {
                    results = results.concat(countLines(fullPath));
                }
            } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n').length;
                if (lines >= 1000) { 
                    results.push({ file: fullPath.replace(/\\/g, '/'), lines });
                }
            }
        }
    } catch (e) {
        console.error("Error reading dir", dir, e);
    }
    return results;
}

const clientBig = countLines('client/src');
const serverBig = countLines('server');
const allBig = [...clientBig, ...serverBig].sort((a,b) => b.lines - a.lines);
console.log(JSON.stringify(allBig, null, 2));
