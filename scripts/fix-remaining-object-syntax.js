#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pattern to find and fix remaining object literal syntax issues
const patterns = [
  // Fix the specific pattern from the files I just read
  {
    // Pattern: if (this.auditLog?.[0]) { followed by property on next line
    search: /if\s*\(\s*this\.auditLog\?\.\[0\]\s*\)\s*\{\s*\n\s*([^}]+)\s*\n\s*\}/gm,
    replace: '$1'
  },
  // Pattern: if (condition) { followed by property: value
  {
    search: /if\s*\([^)]+\)\s*\{\s*\n\s*([a-zA-Z_][a-zA-Z0-9_]*\s*:\s*[^,}]+)\s*\n\s*\}/gm,
    replace: '$1'
  },
  // Pattern: if (condition) { in middle of object
  {
    search: /,\s*\n\s*if\s*\([^)]+\)\s*\{\s*\n\s*([a-zA-Z_][a-zA-Z0-9_]*\s*:\s*[^,}]+)\s*\n\s*\}/gm,
    replace: ',\n    $1'
  },
  // Fix remaining broken duration calculation in performance-monitor.ts
  {
    search: /duration:\s*this\.metrics\.length\s*>\s*0\s*\?\s*if\s*\(\s*this\.auditLog\?\.\[0\]\s*\)\s*\{\s*\?\s*this\.metrics\[this\.metrics\.length\s*-\s*1\]\.timestamp\s*-\s*this\.metrics\[0\]\.timestamp\s*:/,
    replace: 'duration: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp :'
  }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const pattern of patterns) {
      const newContent = content.replace(pattern.search, pattern.replace);
      if (newContent !== content) {
        modified = true;
        content = newContent;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findTypeScriptFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Main execution
const projectRoot = process.cwd();
console.log('Finding TypeScript files...');

const tsFiles = findTypeScriptFiles(projectRoot);
console.log(`Found ${tsFiles.length} TypeScript files`);

let fixedCount = 0;

for (const file of tsFiles) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed object literal syntax in ${fixedCount} files`);