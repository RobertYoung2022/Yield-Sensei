#!/usr/bin/env node

/**
 * Sage Testing Suite Validation Script
 * 
 * Validates that the Sage testing infrastructure is properly set up
 * and ready for component implementation.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Sage Testing Suite Validation...\n');

const validationResults = {
  timestamp: new Date().toISOString(),
  tests: [],
  errors: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

function runTest(name, testFn) {
  validationResults.summary.total++;
  try {
    testFn();
    validationResults.tests.push({ name, status: 'PASSED' });
    validationResults.summary.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    validationResults.tests.push({ name, status: 'FAILED', error: error.message });
    validationResults.errors.push({ test: name, error: error.message });
    validationResults.summary.failed++;
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Test 1: Check file structure
runTest('Testing file structure exists', () => {
  const requiredFiles = [
    'tests/satellites/sage/config/jest.sage.config.js',
    'tests/satellites/sage/config/jest.setup.js',
    'tests/satellites/sage/config/custom-matchers.js',
    'tests/satellites/sage/config/test-sequencer.js',
    'tests/satellites/sage/config/results-processor.js',
    'tests/satellites/sage/README.md',
    '.github/workflows/sage-tests.yml'
  ];

  const projectRoot = process.cwd();
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
});

// Test 2: Check package.json scripts
runTest('Package.json test scripts configured', () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredScripts = [
    'test:sage',
    'test:sage:unit',
    'test:sage:integration',
    'test:sage:performance',
    'test:sage:validation',
    'test:sage:all',
    'test:sage:watch',
    'test:sage:report'
  ];

  for (const script of requiredScripts) {
    if (!packageJson.scripts[script]) {
      throw new Error(`Missing package.json script: ${script}`);
    }
  }
});

// Test 3: Check Jest configuration
runTest('Jest configuration is valid', () => {
  const jestConfigPath = path.join(process.cwd(), 'tests/satellites/sage/config/jest.sage.config.js');
  
  // Try to require the Jest config
  const jestConfig = require(jestConfigPath);
  
  const requiredConfigKeys = [
    'testEnvironment',
    'rootDir',
    'testMatch',
    'transform',
    'moduleNameMapper',
    'collectCoverage',
    'coverageDirectory',
    'coverageThreshold'
  ];

  for (const key of requiredConfigKeys) {
    if (!jestConfig[key]) {
      throw new Error(`Missing Jest config key: ${key}`);
    }
  }

  // Validate coverage thresholds
  const thresholds = jestConfig.coverageThreshold.global;
  if (thresholds.statements < 80 || thresholds.lines < 80 || thresholds.functions < 80) {
    throw new Error('Coverage thresholds are too low');
  }
});

// Test 4: Check dependencies
runTest('Required dependencies are installed', () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDevDeps = [
    'jest',
    'ts-jest',
    'jest-html-reporters',
    'jest-junit',
    'jest-watch-typeahead',
    'nock'
  ];

  for (const dep of requiredDevDeps) {
    if (!packageJson.devDependencies[dep]) {
      throw new Error(`Missing dev dependency: ${dep}`);
    }
  }
});

// Test 5: Check test utilities
runTest('Test utilities are properly structured', () => {
  const setupPath = path.join(process.cwd(), 'tests/satellites/sage/config/jest.setup.js');
  const setupContent = fs.readFileSync(setupPath, 'utf8');
  
  const requiredUtilities = [
    'measurePerformance',
    'getMemoryUsage',
    'createMockRWAData',
    'createMockProtocolData',
    'generateId'
  ];

  for (const utility of requiredUtilities) {
    if (!setupContent.includes(utility)) {
      throw new Error(`Missing test utility: ${utility}`);
    }
  }
});

// Test 6: Check custom matchers
runTest('Custom Jest matchers are implemented', () => {
  const matchersPath = path.join(process.cwd(), 'tests/satellites/sage/config/custom-matchers.js');
  const matchersContent = fs.readFileSync(matchersPath, 'utf8');
  
  const requiredMatchers = [
    'toBeValidRWAScore',
    'toBeValidProtocolAnalysis',
    'toBeValidComplianceAssessment',
    'toMeetPerformanceThreshold',
    'toBeConsistentWith',
    'toBeInScoreRange',
    'toHaveValidRecommendations',
    'toHaveValidFactors'
  ];

  for (const matcher of requiredMatchers) {
    if (!matchersContent.includes(matcher)) {
      throw new Error(`Missing custom matcher: ${matcher}`);
    }
  }
});

// Test 7: Check GitHub Actions workflow
runTest('GitHub Actions workflow is configured', () => {
  const workflowPath = path.join(process.cwd(), '.github/workflows/sage-tests.yml');
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');
  
  const requiredJobs = [
    'unit-tests',
    'integration-tests',
    'performance-tests',
    'validation-tests',
    'comprehensive-tests'
  ];

  for (const job of requiredJobs) {
    if (!workflowContent.includes(job)) {
      throw new Error(`Missing GitHub Actions job: ${job}`);
    }
  }
});

// Test 8: Validate test file templates
runTest('Test file templates are comprehensive', () => {
  const testFiles = [
    'tests/satellites/sage/comprehensive-sage-testing-suite.test.ts',
    'tests/satellites/sage/regression-testing-suite.test.ts',
    'tests/satellites/sage/cross-component-integration.test.ts',
    'tests/satellites/sage/change-impact-analysis.test.ts',
    'tests/satellites/sage/sage-testing-suite-validation.test.ts'
  ];

  for (const testFile of testFiles) {
    const filePath = path.join(process.cwd(), testFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing test file: ${testFile}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length < 1000) {
      throw new Error(`Test file too small (likely incomplete): ${testFile}`);
    }
  }
});

// Test 9: Check test documentation
runTest('Test documentation is comprehensive', () => {
  const readmePath = path.join(process.cwd(), 'tests/satellites/sage/README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  const requiredSections = [
    'Quick Start',
    'Test Categories',
    'Configuration',
    'Custom Matchers',
    'Performance Monitoring',
    'Contributing'
  ];

  for (const section of requiredSections) {
    if (!readmeContent.includes(section)) {
      throw new Error(`Missing documentation section: ${section}`);
    }
  }
});

// Test 10: Performance configuration validation
runTest('Performance thresholds are reasonable', () => {
  const setupPath = path.join(process.cwd(), 'tests/satellites/sage/config/jest.setup.js');
  const setupContent = fs.readFileSync(setupPath, 'utf8');
  
  // Check for performance configuration
  if (!setupContent.includes('performance')) {
    throw new Error('Performance configuration not found');
  }

  if (!setupContent.includes('rwaScoring') || !setupContent.includes('protocolAnalysis')) {
    throw new Error('Performance thresholds not properly configured');
  }
});

// Generate final report
console.log('\n' + '='.repeat(60));
console.log('📊 SAGE TESTING SUITE VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`📅 Validation Date: ${new Date().toLocaleString()}`);
console.log(`🔢 Total Tests: ${validationResults.summary.total}`);
console.log(`✅ Passed: ${validationResults.summary.passed}`);
console.log(`❌ Failed: ${validationResults.summary.failed}`);

const successRate = (validationResults.summary.passed / validationResults.summary.total * 100).toFixed(1);
console.log(`📈 Success Rate: ${successRate}%`);

const overallStatus = validationResults.summary.failed === 0 ? 'PASSED' : 'FAILED';
console.log(`🎯 Overall Status: ${overallStatus}`);

if (validationResults.errors.length > 0) {
  console.log('\n❌ ERRORS ENCOUNTERED:');
  validationResults.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error.test}: ${error.error}`);
  });
}

if (overallStatus === 'PASSED') {
  console.log('\n🎉 SUCCESS! Sage Testing Suite is ready for implementation.');
  console.log('\n📋 What\'s been validated:');
  console.log('  ✅ Complete file structure in place');
  console.log('  ✅ Jest configuration optimized for TypeScript');
  console.log('  ✅ Custom matchers for domain-specific validation');
  console.log('  ✅ Performance measurement and monitoring');
  console.log('  ✅ Mock data generators for RWA and protocol data');
  console.log('  ✅ GitHub Actions CI/CD pipeline');
  console.log('  ✅ Comprehensive test templates');
  console.log('  ✅ Documentation and guidelines');
  console.log('  ✅ npm scripts for all test scenarios');
  console.log('  ✅ Coverage thresholds and reporting');

  console.log('\n🚀 NEXT STEPS:');
  console.log('  1. Implement Sage satellite core components:');
  console.log('     - SageSatelliteAgent');
  console.log('     - RWAOpportunityScoring');
  console.log('     - FundamentalAnalysisEngine');
  console.log('     - ComplianceMonitoringFramework');
  console.log('     - PerplexityAPIIntegration');
  console.log('  2. Define TypeScript interfaces in src/satellites/sage/types/');
  console.log('  3. Run component-specific tests as you implement');
  console.log('  4. Execute integration tests between components');
  console.log('  5. Run performance and load tests');
  console.log('  6. Generate final test coverage reports');

  console.log('\n📝 Available test commands:');
  console.log('  • npm run test:sage:unit           - Run unit tests only');
  console.log('  • npm run test:sage:integration    - Run integration tests');
  console.log('  • npm run test:sage:performance    - Run performance tests');
  console.log('  • npm run test:sage:validation     - Run validation tests');
  console.log('  • npm run test:sage:all            - Run complete test suite');
  console.log('  • npm run test:sage:watch          - Run tests in watch mode');
  console.log('  • npm run test:sage:report         - Generate test reports');

} else {
  console.log('\n❌ VALIDATION FAILED. Please fix the errors above before proceeding.');
}

// Write validation report
const reportPath = path.join(process.cwd(), 'coverage/sage/validation-infrastructure-report.json');
const reportDir = path.dirname(reportPath);

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(reportPath, JSON.stringify(validationResults, null, 2));
console.log(`\n📄 Detailed report saved to: ${reportPath}`);

console.log('\n' + '='.repeat(60));

// Exit with appropriate code
process.exit(validationResults.summary.failed === 0 ? 0 : 1);