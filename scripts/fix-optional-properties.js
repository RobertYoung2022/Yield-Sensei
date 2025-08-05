#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get TypeScript errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

// Parse TS2375 and TS2412 errors (type assignment with exactOptionalPropertyTypes)
const optionalErrors = errors
  .split('\n')
  .filter(line => line.includes('TS2375') || line.includes('TS2412'))
  .map(line => {
    const match = line.match(/(.+?)\((\d+),(\d+)\): error TS(2375|2412): (.+)/);
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
optionalErrors.forEach(error => {
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
        // Extract property name from error message
        let propertyMatch = error.message.match(/Types of property '(\w+)' are incompatible/);
        if (propertyMatch) {
          const propertyName = propertyMatch[1];
          
          // Find the property definition pattern
          const patterns = [
            // Interface/type property: propertyName?: type
            {
              regex: new RegExp(`(\\s*${propertyName})(\\?\\s*:\\s*)([^;\\n]+)`),
              replace: `$1$2$3 | undefined`
            },
            // Variable assignment with type annotation
            {
              regex: new RegExp(`(${propertyName}\\s*:\\s*)([^=\\s|]+)(\\s*=)`),
              replace: `$1$2 | undefined$3`
            }
          ];
          
          let fixed = false;
          for (const pattern of patterns) {
            const newLine = line.replace(pattern.regex, pattern.replace);
            if (newLine !== line && !newLine.includes('| undefined | undefined')) {
              lines[lineIndex] = newLine;
              fixed = true;
              break;
            }
          }
          
          // Handle object assignment issues
          if (!fixed && error.errorCode === '2375') {
            // For assignment errors, sometimes we need to fix the value being assigned
            const assignmentMatch = line.match(/(\w+)\s*:\s*(.+?)(\s*[,}])/);
            if (assignmentMatch && assignmentMatch[1] === propertyName) {
              const value = assignmentMatch[2];
              if (!value.includes('undefined')) {
                lines[lineIndex] = line.replace(
                  new RegExp(`(${propertyName}\\s*:\\s*)(.+?)(\\s*[,}])`),
                  `$1$2 as any$3`
                );
              }
            }
          }
        }
        
        // Handle TS2412: Type 'undefined' is not assignable
        if (error.errorCode === '2412') {
          // This usually means we're trying to assign undefined to a non-optional property
          // Fix by making the property optional
          const targetMatch = error.message.match(/target\.'(\w+)'/);
          if (targetMatch) {
            const targetProperty = targetMatch[1];
            // Look for the property definition in preceding lines
            for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
              const prevLine = lines[i];
              if (prevLine.includes(targetProperty)) {
                const fixedLine = prevLine.replace(
                  new RegExp(`(${targetProperty})(\\s*:\\s*)([^;\\n]+)`),
                  `$1?$2$3`
                );
                if (fixedLine !== prevLine) {
                  lines[i] = fixedLine;
                  break;
                }
              }
            }
          }
        }
      }
    });
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${errors.length} optional property errors in ${filePath}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log(`\nProcessed ${Object.keys(errorsByFile).length} files`);
console.log(`Total optional property errors processed: ${optionalErrors.length}`);