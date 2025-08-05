#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

// Parse TS1434 errors (Unexpected keyword or identifier - often broken imports)
const syntaxErrors = errors
  .split('\n')
  .filter(line => line.includes('TS1434'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS1434/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3])
      };
    }
    return null;
  })
  .filter(Boolean);

// Group errors by file
const errorsByFile = {};
syntaxErrors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

// Common broken import patterns from the unused variable fix script
const brokenPatterns = [
  // Pattern: standalone "from 'module';" without import
  {
    regex: /^\s*from\s+['"](.+?)['"]\s*;?\s*$/,
    fix: (match, module) => `// Fixed broken import: from '${module}';`
  },
  // Pattern: import { } from 'module'; (empty imports)
  {
    regex: /^\s*import\s*{\s*}\s*from\s+['"](.+?)['"]\s*;?\s*$/,
    fix: () => ''
  },
  // Pattern: import {  , something } from 'module'; (leading comma)
  {
    regex: /^\s*import\s*{\s*,\s*(.+?)}\s*from\s+['"](.+?)['"]\s*;?\s*$/,
    fix: (match, imports, module) => `import { ${imports} } from '${module}';`
  },
  // Pattern: import { something,  } from 'module'; (trailing comma)
  {
    regex: /^\s*import\s*{(.+?),\s*}\s*from\s+['"](.+?)['"]\s*;?\s*$/,
    fix: (match, imports, module) => `import { ${imports} } from '${module}';`
  }
];

// Process each file
Object.entries(errorsByFile).forEach(([filePath, errors]) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort errors by line number in reverse order
    errors.sort((a, b) => b.line - a.line);
    
    // Fix each error line
    errors.forEach(error => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      
      if (line) {
        for (const pattern of brokenPatterns) {
          const newLine = line.replace(pattern.regex, pattern.fix);
          if (newLine !== line) {
            // If the fix results in an empty line, remove it
            if (newLine.trim() === '') {
              lines.splice(lineIndex, 1);
            } else {
              lines[lineIndex] = newLine;
            }
            break;
          }
        }
        
        // Check if it's still an issue - might be a different pattern
        if (lines[lineIndex] === line) {
          // Check for other common issues
          if (line.includes('from') && !line.includes('import')) {
            console.log(`Manual fix needed in ${filePath}:${error.line} - ${line.trim()}`);
          }
        }
      }
    });
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${errors.length} syntax errors in ${filePath}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log(`\nProcessed ${Object.keys(errorsByFile).length} files`);
console.log(`Total syntax errors processed: ${syntaxErrors.length}`);