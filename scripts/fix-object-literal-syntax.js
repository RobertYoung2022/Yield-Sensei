#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get files with TS1005, TS1128, TS1434 errors
const errors = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf8' });

const syntaxErrorFiles = new Set();
errors.split('\n')
  .filter(line => line.includes('TS1005') || line.includes('TS1128') || line.includes('TS1434'))
  .forEach(line => {
    const match = line.match(/(.+?)\(/);
    if (match) {
      syntaxErrorFiles.add(match[1]);
    }
  });

console.log(`Found ${syntaxErrorFiles.size} files with syntax errors`);

// Process each file
Array.from(syntaxErrorFiles).forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Pattern 1: Remove if-guards inside object literals
    // Look for patterns like:
    //   someProperty: value,
    //   if (condition) {
    //   anotherProperty: value,
    //   }
    content = content.replace(
      /(\s*[\w$]+\s*:\s*[^,\n}]+,?\s*\n\s*)if\s*\([^)]+\)\s*{\s*\n(\s*[\w$]+\s*:\s*[^,\n}]+,?\s*\n\s*)}\s*\n/g,
      '$1$2'
    );
    
    // Pattern 2: Remove if-guards that wrap single properties
    // if (condition) {
    // property: value,
    // }
    content = content.replace(
      /(\s*)if\s*\([^)]+\)\s*{\s*\n(\s*[\w$]+\s*:\s*[^,\n}]+,?\s*\n)\s*}\s*\n/g,
      '$2'
    );
    
    // Pattern 3: Remove standalone if-guards in object contexts
    content = content.replace(
      /(\s*)if\s*\(this\.auditLog\[0\]\)\s*{\s*\n/g,
      ''
    );
    
    // Pattern 4: Remove orphaned closing braces from removed if statements
    content = content.replace(
      /^(\s*)}(\s*)$/gm,
      ''
    );
    
    // Pattern 5: Fix broken object properties that got split across lines
    content = content.replace(
      /(\s*[\w$]+):\s*\n(\s*[^,\n}]+,?)/g,
      '$1: $2'
    );
    
    // Pattern 6: Clean up multiple consecutive commas
    content = content.replace(
      /,(\s*,)+/g,
      ','
    );
    
    // Pattern 7: Remove trailing commas before closing braces when they cause issues
    content = content.replace(
      /,(\s*\n\s*})/g,
      '$1'
    );
    
    // Pattern 8: Fix specific "if (this.auditLog[0])" pattern issues
    content = content.replace(
      /if\s*\(this\.auditLog\[0\]\)\s*\{\s*\n([^}]*)\n\s*\}/g,
      '$1'
    );
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed syntax errors in ${filePath}`);
    }
    
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log('Syntax error fix completed');