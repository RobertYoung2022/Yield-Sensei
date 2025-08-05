#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixFinancialDataService() {
  const filePath = '/Users/bobbyyo/Projects/YieldSensei/src/integrations/perplexity/services/financial-data.service.ts';
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the specific syntax issues identified in this file
    content = content
      // Fix missing closing brace for interface
      .replace(/includeAnalysis\?: boolean;\s*\n\s*export class/, 'includeAnalysis?: boolean;\n}\n\nexport class')
      // Fix missing closing brace for getSecFilings method
      .replace(/return filings;\s*\n\s*} catch \(error\) \{\s*\n\s*logger\.error\('Failed to fetch SEC filings:', error\);\s*\n\s*throw error;\s*\n\s*\n\s*async analyzeFinancialData/, 'return filings;\n    } catch (error) {\n      logger.error(\'Failed to fetch SEC filings:\', error);\n      throw error;\n    }\n  }\n\n  async analyzeFinancialData')
      // Fix missing closing brace for constructor
      .replace(/this\.client = client;\s*\n\s*async getSecFilings/, 'this.client = client;\n  }\n\n  async getSecFilings')
      // Fix missing closing brace for messages array item
      .replace(/content: promptContext\s*\n\s*\]\,/, 'content: promptContext\n          }\n        ],')
      // Fix missing closing brace for messages array item in analysis
      .replace(/content: this\.buildAnalysisPrompt\(filing\)\s*\n\s*\]\,/, 'content: this.buildAnalysisPrompt(filing)\n          }\n        ],')
      // Fix missing closing brace for for loop
      .replace(/filing\.analysis = await this\.analyzeFinancialData\(filing\);\s*\n\s*\n\s*logger\.info/, 'filing.analysis = await this.analyzeFinancialData(filing);\n        }\n      }\n\n      logger.info');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed financial-data.service.ts syntax issues');
    
  } catch (error) {
    console.error('Error fixing financial-data.service.ts:', error.message);
  }
}

function fixOtherSyntaxIssues() {
  const files = [
    '/Users/bobbyyo/Projects/YieldSensei/tests/performance/performance-monitor.ts',
    '/Users/bobbyyo/Projects/YieldSensei/src/satellites/oracle/validation/oracle-feed-validator.ts'
  ];
  
  for (const filePath of files) {
    try {
      if (!fs.existsSync(filePath)) continue;
      
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Fix missing closing brace in object literals
      const newContent = content
        .replace(/anomalies: this\.getAnomalies\(\)\s*\n\s*}\;/, 'anomalies: this.getAnomalies()\n    };')
        .replace(/if \(this\.auditLog\?\.\[0\]\) \{\s*\n\s*\?\s*this\.metrics/, '? this.metrics')
        .replace(/\?\s*this\.metrics\[this\.metrics\.length\s*-\s*1\]\.timestamp\s*-\s*this\.metrics\[0\]\.timestamp\s*\n\s*:/, '? this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp :');
      
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed syntax issues in ${path.basename(filePath)}`);
        modified = true;
      }
      
    } catch (error) {
      console.error(`Error fixing ${filePath}:`, error.message);
    }
  }
}

// Main execution
console.log('Fixing specific syntax issues...');
fixFinancialDataService();
fixOtherSyntaxIssues();
console.log('Specific syntax fixes completed');