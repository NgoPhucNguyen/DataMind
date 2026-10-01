const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const packageJsonPath = path.join(__dirname, 'package.json');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const deps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {})
]);

const importRegex = /import\s+.*?from\s+['"]([^./]['"]*|[^"'].*?)['"]/g;
const dynamicImportRegex = /import\(['"]([^./]['"]*|[^"'].*?)['"]\)/g;

const usedDeps = new Set();

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        let pkgName = match[1];
        if (pkgName.startsWith('@')) {
          const parts = pkgName.split('/');
          pkgName = parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
        } else {
          pkgName = pkgName.split('/')[0];
        }
        usedDeps.add(pkgName);
      }
      
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        let pkgName = match[1];
        if (pkgName.startsWith('@')) {
          const parts = pkgName.split('/');
          pkgName = parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
        } else {
          pkgName = pkgName.split('/')[0];
        }
        usedDeps.add(pkgName);
      }
    }
  }
}

walk(srcDir);

const missing = [];
for (const d of usedDeps) {
  // Ignore node built-ins or styling/assets if they slip through
  if (d.endsWith('.css') || d.endsWith('.svg') || d.endsWith('.png')) continue;
  if (!deps.has(d)) {
    missing.push(d);
  }
}

console.log(JSON.stringify({ used: Array.from(usedDeps), missing }, null, 2));
