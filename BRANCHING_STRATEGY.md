# YieldSensei Git Branching Strategy

## Branch Structure

### Main Branches
- **main** - Production-ready code, stable releases
- **develop** - Integration branch for all feature development
- **staging** - Pre-production testing and validation

### Feature Branches
Development branches for each satellite system and core components:

#### Satellite System Branches
- **feature/sage-satellite** - Sage (Logic & Research) development
- **feature/forge-satellite** - Forge (Builder & Engineering) development  
- **feature/pulse-satellite** - Pulse (Growth & Optimization) development
- **feature/aegis-satellite** - Aegis (Security & Risk) development
- **feature/echo-satellite** - Echo (Sentiment & Community) development
- **feature/fuel-satellite** - Fuel (Logistics & Capital) development
- **feature/bridge-satellite** - Bridge (Cross-Chain) development
- **feature/oracle-satellite** - Oracle (Data Integrity) development

#### Infrastructure Branches
- **feature/core-orchestration** - Multi-agent orchestration system
- **feature/database-integration** - Database and storage systems
- **feature/api-framework** - REST and GraphQL API development
- **feature/monitoring** - Monitoring and observability
- **feature/security** - Security implementations
- **feature/testing** - Testing infrastructure and suites

#### Integration Branches
- **feature/elizaos-integration** - ElizaOS plugin integrations
- **feature/perplexity-integration** - Perplexity API integration
- **feature/defi-protocols** - DeFi protocol integrations

### Hotfix Branches
- **hotfix/critical-fix-description** - Critical production fixes

## Workflow

### Feature Development
1. Create feature branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/satellite-name
   ```

2. Develop and commit changes
   ```bash
   git add .
   git commit -m "feat(satellite): implement specific feature"
   ```

3. Push and create pull request to `develop`
   ```bash
   git push origin feature/satellite-name
   ```

### Release Process
1. Create release branch from `develop`
   ```bash
   git checkout develop
   git checkout -b release/v1.0.0
   ```

2. Final testing and bug fixes
3. Merge to `main` and `develop`
4. Tag release
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin --tags
   ```

### Hotfix Process
1. Create hotfix branch from `main`
   ```bash
   git checkout main
   git checkout -b hotfix/critical-security-fix
   ```

2. Fix issue and test
3. Merge to both `main` and `develop`

## Commit Message Convention

Follow Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes
- **build**: Build system changes

### Scopes (Optional)
- **core**: Core orchestration system
- **sage**: Sage satellite
- **forge**: Forge satellite
- **pulse**: Pulse satellite
- **aegis**: Aegis satellite
- **echo**: Echo satellite
- **fuel**: Fuel satellite
- **bridge**: Bridge satellite
- **oracle**: Oracle satellite
- **db**: Database-related
- **api**: API-related
- **security**: Security-related
- **test**: Test-related

### Examples
```bash
feat(sage): implement SEC filing analysis
fix(aegis): resolve liquidation calculation bug
docs(api): update REST API documentation
perf(bridge): optimize cross-chain execution speed
test(core): add unit tests for orchestration
```

## Branch Protection Rules

### Main Branch Protection
- Require pull request reviews (minimum 2)
- Require status checks to pass
- Require branches to be up to date
- Require conversation resolution
- Restrict pushes to specific teams

### Develop Branch Protection  
- Require pull request reviews (minimum 1)
- Require status checks to pass
- Require conversation resolution

## Parallel Development Strategy

For complex satellite systems, use parallel development:

1. **Main Development**: Primary implementation branch
2. **Performance Branch**: Performance optimization branch  
3. **Testing Branch**: Comprehensive testing branch
4. **Integration Branch**: Integration testing branch

Merge order: Testing → Performance → Integration → Main Development → Develop

## Git Hooks

### Pre-commit Hooks
- Lint code (ESLint, Prettier)
- Run type checking (TypeScript)
- Run unit tests
- Security scan (npm audit)
- Check commit message format

### Pre-push Hooks
- Run integration tests
- Build verification
- Performance benchmarks

### Post-merge Hooks
- Update dependencies
- Regenerate documentation
- Notify team of changes