#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Comprehensive syntax fixes for TypeScript files
function fixCommonSyntaxIssues(content) {
  let fixed = content;
  
  // Fix missing closing braces for interfaces and classes
  fixed = fixed.replace(/^(export interface \w+\s*\{[^}]*)\n(export (?:class|interface|enum))/gm, '$1}\n\n$2');
  
  // Fix missing closing braces for methods
  fixed = fixed.replace(/^(\s+)(async \w+\([^)]*\)[^{]*\{[^}]*)\n(\s+)(async \w+|private \w+|public \w+|\})/gm, 
                       '$1$2\n$1}\n\n$3$4');
  
  // Fix missing closing braces in object literals
  fixed = fixed.replace(/(\{[^}]*),\s*\n\s*(\w+:)/g, '$1,\n    $2');
  
  // Fix trailing commas and semicolons in interfaces
  fixed = fixed.replace(/;\s*\n\s*\}/g, '\n}');
  
  // Fix constructor issues
  fixed = fixed.replace(/constructor\([^)]*\)\s*\{\s*super\(\);[^}]*\n\s*async/g, 
                       match => match.replace(/\n\s*async/, '\n  }\n\n  async'));
  
  // Fix missing return types and semicolons
  fixed = fixed.replace(/\n(\s+})\n(\s+catch)/g, '\n$1\n$2');
  
  return fixed;
}

// Fix specific known patterns that break compilation
function fixSpecificPatterns(content) {
  let fixed = content;
  
  // Fix broken object literals with if statements
  fixed = fixed.replace(/\{\s*if\s*\([^)]+\)\s*\{\s*([^}]+)\s*\}\s*\}/g, '{ $1 }');
  
  // Fix broken property assignments
  fixed = fixed.replace(/(\w+):\s*if\s*\([^)]+\)\s*\{\s*([^}]+)\s*\}/g, '$1: $2');
  
  // Fix missing commas in object literals
  fixed = fixed.replace(/\}\s*\n\s*(\w+:)/g, '},\n    $1');
  
  // Fix async method declarations
  fixed = fixed.replace(/async (\w+)\([^)]*\):\s*Promise<[^>]*>\s*\{[^}]*\n\s*(\w)/g,
                       match => match.includes('}') ? match : match + '\n  }');
  
  return fixed;
}

// Process a single file
function fixFile(filePath) {
  try {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return false;
    }
    
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let content = originalContent;
    
    // Apply comprehensive fixes
    content = fixCommonSyntaxIssues(content);
    content = fixSpecificPatterns(content);
    
    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Find and process TypeScript files
function findAndFixFiles(dir, maxFiles = 50) {
  const files = [];
  let processedCount = 0;
  
  function traverse(currentDir) {
    if (processedCount >= maxFiles) return;
    
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        if (processedCount >= maxFiles) break;
        
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && 
            !item.startsWith('.') && 
            item !== 'node_modules' && 
            item !== 'dist' && 
            item !== 'build') {
          traverse(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
          files.push(fullPath);
          processedCount++;
        }
      }
    } catch (error) {
      console.error(`Error traversing ${currentDir}:`, error.message);
    }
  }
  
  traverse(dir);
  return files;
}

// Main execution
console.log('Starting comprehensive TypeScript syntax fixes...');

// Focus on most problematic directories first
const priorityDirs = [
  'src/integrations/perplexity/services',
  'src/satellites',
  'tests/performance'
];

let totalFixed = 0;

for (const dir of priorityDirs) {
  const fullDir = path.join(process.cwd(), dir);
  if (fs.existsSync(fullDir)) {
    console.log(`\nProcessing ${dir}...`);
    const files = findAndFixFiles(fullDir, 20);
    
    for (const file of files) {
      if (fixFile(file)) {
        totalFixed++;
      }
    }
  }
}

console.log(`\nFixed syntax issues in ${totalFixed} files`);
console.log('Running TypeScript compilation check...');

// Quick validation
const { execSync } = require('child_process');
try {
  const result = execSync('npx tsc --noEmit 2>&1 | grep "error TS" | wc -l', { encoding: 'utf8' });
  const errorCount = parseInt(result.trim());
  console.log(`Current error count: ${errorCount}`);
} catch (error) {
  console.log('Could not get error count, but fixes have been applied');
}