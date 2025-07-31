# YieldSensei CI/CD Pipeline

This directory contains the complete CI/CD infrastructure for YieldSensei, including automated testing, quality gates, and deployment workflows.

## 🏗️ Architecture Overview

The CI/CD pipeline is designed with multiple layers of validation and quality assurance:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PR Checks     │    │  Main Pipeline  │    │ Scheduled Tests │
│                 │    │                 │    │                 │
│ • Quick validation    │ • Full test suite    │ • Comprehensive │
│ • Targeted tests      │ • Security scans     │ • Stress testing│
│ • Coverage check      │ • Quality gates      │ • Performance   │
│ • Performance        │ • Deploy           │ • Security audit│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 File Structure

```
.github/
├── workflows/
│   ├── ci.yml              # Main CI/CD pipeline
│   ├── pr-checks.yml       # Fast PR validation
│   └── scheduled-tests.yml # Comprehensive testing
├── branch-protection.json  # Branch protection rules
├── notification-config.json # Notification settings
├── CODEOWNERS             # Code ownership rules
└── README.md              # This file
```

## 🔄 Workflows

### 1. Main CI/CD Pipeline (`ci.yml`)

**Triggers:**
- Push to `main`, `develop`, `release/*`
- Pull requests to `main`, `develop`
- Daily scheduled runs (2 AM UTC)
- Manual dispatch

**Jobs:**
- **Validation**: Linting, TypeScript checking, security audit
- **Unit Tests**: Parallel execution across Node versions and shards
- **Integration Tests**: Full database and service integration
- **Performance Tests**: Benchmarking and regression detection
- **Security Tests**: Vulnerability scanning and validation
- **Rust Tests**: Aegis satellite testing
- **Quality Gate**: Comprehensive quality assessment
- **Deploy**: Production deployment (main branch only)

### 2. PR Checks (`pr-checks.yml`)

**Triggers:**
- Pull request opened, synchronized, or reopened

**Features:**
- Fast feedback (< 15 minutes)
- Targeted testing based on changed files
- Performance impact analysis
- Security scanning for new vulnerabilities
- Coverage validation for changed files

### 3. Scheduled Tests (`scheduled-tests.yml`)

**Triggers:**
- Daily at 2 AM UTC
- Weekly extended tests on Fridays
- Manual dispatch with test depth selection

**Components:**
- Comprehensive satellite testing
- Extended integration testing
- Stress and load testing
- Security vulnerability scanning
- Performance benchmarking

## 🧪 Test Strategy

### Test Categories

1. **Unit Tests**
   - Individual component testing
   - Parallel execution across 4 shards
   - Multiple Node.js versions (18, 20, 21)
   - Target: < 5 minutes execution

2. **Integration Tests** 
   - Database integration (PostgreSQL, Redis)
   - Service-to-service communication
   - End-to-end workflows
   - Target: < 10 minutes execution

3. **Security Tests**
   - Vulnerability scanning
   - Encryption validation
   - Environment security checks
   - Compliance verification

4. **Performance Tests**
   - Load testing
   - Memory usage validation
   - Response time benchmarking
   - Regression detection

5. **Satellite Tests**
   - Echo: Social sentiment analysis
   - Sage: RWA opportunity scoring
   - Bridge: Cross-chain operations
   - Aegis: Security monitoring (Rust)
   - Pulse: Yield optimization
   - Forge: Strategy execution
   - Oracle: Data validation

### Test Parallelization

Tests are parallelized using multiple strategies:

```bash
# Shard-based parallelization (4 shards)
npm test -- --shard=1/4

# Worker-based parallelization
npm test -- --maxWorkers=50%

# Node version matrix testing
matrix:
  node-version: ['18.x', '20.x', '21.x']
```

## 🎯 Quality Gates

Quality gates prevent deployment of code that doesn't meet standards:

### Required Metrics
- **Test Pass Rate**: 100% (0 failing tests allowed)
- **Code Coverage**: ≥80% overall
- **Security Issues**: 0 critical/high severity
- **Performance**: No regressions >10%
- **TypeScript**: No compilation errors

### Gate Configuration
```javascript
const gates = {
  minCoverage: 80,           // Minimum code coverage
  maxFailingTests: 0,        // Maximum failing tests
  maxSecurityIssues: 0,      // Maximum critical security issues
  maxSlowTests: 10,          // Maximum slow tests (>5s)
  maxTestDuration: 600000    // Maximum test suite duration (10min)
};
```

## 🔒 Security Integration

### Security Scanning

1. **Static Analysis**
   - ESLint security rules
   - TypeScript strict checking
   - Secret detection

2. **Dependency Scanning**
   - npm audit for known vulnerabilities
   - Snyk integration (if token provided)
   - OWASP dependency check

3. **Custom Security Tests**
   - Encryption validation framework
   - Environment security validation
   - Database security testing

### Security Thresholds
- **Critical**: Block deployment immediately
- **High**: Require security team approval
- **Medium**: Warning notification
- **Low**: Informational only

## 📊 Reporting and Notifications

### Test Reports

Reports are automatically generated and stored:

- **Test Results**: JSON format with detailed metrics
- **Coverage Reports**: HTML and JSON formats
- **Performance Reports**: Benchmark comparisons
- **Security Reports**: Vulnerability assessments
- **Comprehensive Reports**: Aggregated Markdown summaries

### Notification Channels

1. **Slack** (Primary)
   - Workflow status updates
   - Security alerts
   - Performance regressions

2. **Email** (Secondary)
   - Daily test summaries
   - Critical failure alerts
   - Security team notifications

3. **GitHub** (Automated)
   - PR status comments
   - Issue creation for failures
   - Status checks

### Notification Configuration

Configure via `.github/notification-config.json`:

```json
{
  "notifications": {
    "slack": {
      "enabled": true,
      "channels": {
        "general": ["workflow_success", "workflow_failure"],
        "security": ["security_vulnerability", "compliance_failure"]
      }
    }
  }
}
```

## 🚀 Performance Optimization

### Test Performance

- **Parallel Execution**: Tests run across multiple workers
- **Smart Caching**: Dependencies and build artifacts cached
- **Selective Testing**: Only test changed components in PRs
- **Resource Optimization**: Appropriate runner sizes for workloads

### Pipeline Performance

- **Concurrent Jobs**: Independent jobs run in parallel
- **Conditional Execution**: Skip unnecessary steps
- **Artifact Sharing**: Efficient data transfer between jobs
- **Early Termination**: Cancel redundant runs

## 🔧 Configuration

### Environment Variables

Required secrets in GitHub repository settings:

```bash
# Notification
SLACK_WEBHOOK_URL          # Slack notifications
EMAIL_USERNAME             # SMTP authentication
EMAIL_PASSWORD             # SMTP authentication
TEAM_LEADS_EMAIL          # Leadership notifications
SECURITY_TEAM_EMAIL       # Security alerts

# External Services
SNYK_TOKEN                # Snyk security scanning
PERPLEXITY_API_KEY       # Perplexity integration
```

### Branch Protection

Branch protection rules are defined in `branch-protection.json`:

- **main**: Strict protection, 2 required reviews, all checks required
- **develop**: Moderate protection, 1 required review, core checks
- **release/***: Strict protection, restricted to release managers

### Code Ownership

Code ownership is defined in `CODEOWNERS`:

- Global ownership by core team
- Specialized ownership for security, infrastructure, satellites
- Required reviews from appropriate teams

## 📈 Monitoring and Metrics

### Key Metrics Tracked

1. **Test Metrics**
   - Pass/fail rates by category
   - Test execution times
   - Coverage trends
   - Flaky test identification

2. **Pipeline Metrics**
   - Build success rates
   - Average build times
   - Queue times
   - Resource utilization

3. **Quality Metrics**
   - Code coverage trends
   - Security vulnerability trends
   - Performance regression frequency
   - Bug escape rates

### Historical Tracking

- Test results stored as GitHub artifacts
- Performance baselines maintained
- Coverage reports archived
- Security scan history preserved

## 🛠️ Maintenance

### Regular Tasks

1. **Weekly**
   - Review flaky tests
   - Update dependency vulnerabilities
   - Check performance baselines

2. **Monthly**
   - Update CI/CD documentation
   - Review and optimize pipeline performance
   - Audit security configurations

3. **Quarterly**
   - Review quality gate thresholds
   - Update notification configurations
   - Evaluate new testing tools

### Troubleshooting

Common issues and solutions:

1. **Test Timeouts**
   - Increase timeout values in jest.config.js
   - Optimize test performance
   - Add parallel execution

2. **Memory Issues**
   - Use larger GitHub runners
   - Optimize memory usage in tests
   - Increase Node.js memory limits

3. **Flaky Tests**
   - Add retry mechanisms
   - Improve test isolation
   - Mock external dependencies

## 🤝 Contributing

When modifying CI/CD configuration:

1. Test changes in a feature branch
2. Document configuration changes
3. Update this README if needed
4. Get approval from DevOps team
5. Monitor deployment impact

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [TypeScript Configuration](https://www.typescriptlang.org/tsconfig)
- [YieldSensei Architecture Guide](../ARCHITECTURE.md)

---

For questions or issues with the CI/CD pipeline, contact the DevOps team or create an issue with the `ci-cd` label.