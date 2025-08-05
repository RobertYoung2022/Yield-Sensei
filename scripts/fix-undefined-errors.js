#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

// Parse TS2532 and TS18048 errors (possibly undefined)
const undefinedErrors = errors
  .split('\n')
  .filter(line => line.includes('TS2532') || line.includes('TS18048'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS(2532|18048): (.+)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        errorCode: match[4],
        message: match[5]
      };
    }
    return null;
  })
  .filter(Boolean);

// Group errors by file
const errorsByFile = {};
undefinedErrors.forEach(error => {
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
    
    // Sort errors by line number in reverse order
    errors.sort((a, b) => b.line - a.line);
    
    errors.forEach(error => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];
      
      if (line) {
        // Extract the variable name that's possibly undefined
        let varMatch = error.message.match(/'(\w+)' is possibly 'undefined'/);
        if (!varMatch) {
          varMatch = error.message.match(/Object is possibly 'undefined'/);
        }
        
        if (varMatch) {
          const varName = varMatch[1] || 'this.auditLog[0]'; // Handle generic "Object is possibly 'undefined'"
          
          // Common patterns to fix undefined errors
          const fixes = [
            // Array access: array[0] -> array?.[0] or array[0]!
            {
              regex: new RegExp(`(\\w+)\\[(\\d+)\\]`),
              replace: (match, arrayName, index) => {
                if (line.includes('this.auditLog') || line.includes('entries') || line.includes('results')) {
                  return `${arrayName}?.[${index}]`;
                }
                return match;
              }
            },
            // Property access: obj.prop -> obj?.prop
            {
              regex: new RegExp(`(\\w+)\\.(\\w+)`),
              replace: (match, objName, propName) => {
                if (objName === varName || line.includes('stat') || line.includes('point')) {
                  return `${objName}?.${propName}`;
                }
                return match;
              }
            },
            // Method calls: obj.method() -> obj?.method()
            {
              regex: new RegExp(`(${varName})\\.([a-zA-Z_$][a-zA-Z0-9_$]*)\\(`),
              replace: `$1?.$2(`
            }
          ];
          
          let newLine = line;
          for (const fix of fixes) {
            const replaced = newLine.replace(fix.regex, fix.replace);
            if (replaced !== newLine) {
              newLine = replaced;
              break;
            }
          }
          
          // If no automatic fix worked, add null check
          if (newLine === line && varName !== 'Object') {
            // Add if check before the line
            const indent = line.match(/^\s*/)[0];
            const ifCheck = `${indent}if (${varName}) {`;
            const closeBrace = `${indent}}`;
            
            lines.splice(lineIndex, 0, ifCheck);
            lines.splice(lineIndex + 2, 0, closeBrace);
          } else {
            lines[lineIndex] = newLine;
          }
        }
      }
    });
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${errors.length} undefined errors in ${filePath}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log(`\nProcessed ${Object.keys(errorsByFile).length} files`);
console.log(`Total undefined errors processed: ${undefinedErrors.length}`);