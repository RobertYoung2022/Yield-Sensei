#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

// Parse TS6133 errors (unused variables)
const unusedVarErrors = errors
  .split('\n')
  .filter(line => line.includes('TS6133'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS6133: '(.+?)' is declared but its value is never read\./);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        variable: match[4]
      };
    }
    return null;
  })
  .filter(Boolean);

// Group errors by file
const errorsByFile = {};
unusedVarErrors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

// Process each file
Object.entries(errorsByFile).forEach(([filePath, errors]) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort errors by line number in reverse order to avoid offset issues
    errors.sort((a, b) => b.line - a.line);
    
    errors.forEach(error => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      
      if (line) {
        // Handle different patterns
        const patterns = [
          // Import patterns
          {
            regex: new RegExp(`import\\s*{([^}]*\\b${error.variable}\\b[^}]*)}`),
            replace: (match, imports) => {
              const importList = imports.split(',').map(i => i.trim());
              const filteredImports = importList.filter(i => !i.includes(error.variable));
              return filteredImports.length > 0 ? `import { ${filteredImports.join(', ')} }` : '';
            }
          },
          // Function parameters
          {
            regex: new RegExp(`(\\b${error.variable}\\b)(\\s*[:,])`),
            replace: `_${error.variable}$2`
          },
          // Destructuring
          {
            regex: new RegExp(`{([^}]*\\b${error.variable}\\b[^}]*)}`),
            replace: (match, content) => {
              return match.replace(new RegExp(`\\b${error.variable}\\b`), `_${error.variable}`);
            }
          },
          // Variable declarations
          {
            regex: new RegExp(`(const|let|var)\\s+${error.variable}\\b`),
            replace: `$1 _${error.variable}`
          }
        ];
        
        let newLine = line;
        for (const pattern of patterns) {
          const newLineCandidate = line.replace(pattern.regex, pattern.replace);
          if (newLineCandidate !== line) {
            newLine = newLineCandidate;
            break;
          }
        }
        
        // If line becomes empty after import removal, remove it
        if (newLine.trim() === '') {
          lines.splice(lineIndex, 1);
        } else {
          lines[lineIndex] = newLine;
        }
      }
    });
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${errors.length} unused variables in ${filePath}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log(`\nProcessed ${Object.keys(errorsByFile).length} files`);
console.log(`Total unused variables fixed: ${unusedVarErrors.length}`);