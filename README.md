# YieldSensei - Multi-Agent DeFi Investment Advisor

## Overview

YieldSensei is a sophisticated multi-agent AI-powered DeFi investment advisor that uses a satellite model architecture. The system combines custom-built performance-critical components with strategic ElizaOS integrations to provide institutional-grade DeFi portfolio management with retail accessibility.

## Architecture

### Satellite Systems (8 Core Agents)

1. **Sage** - Logic & Research (Market analysis, RWA integration)
2. **Forge** - Builder & Engineering (Smart contracts, MEV protection)
3. **Pulse** - Growth & Optimization (Yield farming, staking)
4. **Aegis** - Security & Risk Management (Liquidation protection)
5. **Echo** - Sentiment & Community (Social monitoring, narrative analysis)
6. **Fuel** - Logistics & Capital (Gas optimization, tax management)
7. **Bridge** - Cross-Chain Operations (Multi-chain coordination)
8. **Oracle** - Data Integrity (RWA validation, off-chain verification)

### Technology Stack

#### Performance Tier (Custom)
- **Languages**: Rust, TypeScript, Go, Python, C++
- **Database**: PostgreSQL, ClickHouse, Redis
- **Messaging**: Apache Kafka
- **ML**: Custom models + Vector DB

#### Integration Tier (ElizaOS)
- Social media monitoring
- Community engagement
- DeFi protocol interactions
- Rapid prototyping

#### Intelligence Tier (Perplexity API)
- Financial data analysis
- Regulatory monitoring
- Market intelligence
- Due diligence research

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd YieldSensei

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database
docker-compose up -d database
npm run db:migrate

# Start development environment
npm run dev
```

## Development

### Development Environment Setup

#### Required Environment Variables
Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/yieldsensei
REDIS_URL=redis://localhost:6379

# API Keys (Required for AI features)
ANTHROPIC_API_KEY=your_anthropic_key
PERPLEXITY_API_KEY=your_perplexity_key
OPENAI_API_KEY=your_openai_key

# Blockchain Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
POLYGON_RPC_URL=https://polygon-rpc.com

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

#### Development Tools Setup

This project uses several development tools that are automatically ignored by Git:

1. **Task Master AI** - For development workflow management
   - Configuration files: `.taskmaster/`
   - Task files: `.taskmaster/tasks/`
   - Reports: `.taskmaster/reports/`

2. **Cursor IDE** - For AI-assisted development
   - Configuration: `.cursor/`
   - Rules: `.cursor/rules/`

3. **Claude AI** - For AI assistant integration
   - Commands: `.claude/`

#### Local Development Workflow

```bash
# Start all services
docker-compose up -d

# Run tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Generate coverage reports
npm run test:coverage

# Lint and format code
npm run lint
npm run format

# Type checking
npm run type-check
```

### Task Management
This project uses Task Master AI for development workflow:

```bash
# View current tasks
task-master list

# Get next task to work on
task-master next

# View specific task details
task-master show <id>

# Mark task complete
task-master set-status --id=<id> --status=done
```

### Project Structure
```
YieldSensei/
├── src/
│   ├── satellites/         # 8 satellite systems
│   ├── core/              # Central orchestration
│   ├── shared/            # Shared utilities
│   └── types/             # TypeScript definitions
├── integrations/          # External integrations
├── tests/                 # Test suites
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── deployments/           # Deployment configs
└── monitoring/            # Monitoring & telemetry
```

### Ignored Files and Directories

The following files and directories are automatically ignored by Git to keep the repository clean:

- **Temporary files**: `temp/`, `test-reports/`, `reports/`
- **Coverage reports**: `coverage/`
- **Development tools**: `.taskmaster/`, `.cursor/`, `.claude/`
- **Environment files**: `.env*`
- **Build artifacts**: `dist/`, `build/`
- **Logs**: `*.log`, `logs/`
- **IDE files**: `.vscode/`, `.idea/`
- **OS files**: `.DS_Store`, `Thumbs.db`

### Database Setup

```bash
# Start PostgreSQL with HA setup
cd deployments/postgresql-ha
docker-compose up -d

# Start ClickHouse for analytics
cd deployments/clickhouse
docker-compose up -d

# Start Redis cluster
cd deployments/redis
docker-compose up -d

# Start Kafka for messaging
cd deployments/kafka
docker-compose up -d
```

### Monitoring Setup

```bash
# Start Prometheus and Grafana
cd monitoring
docker-compose up -d

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin
```

### Security Testing

```bash
# Run security tests
npm run test:security

# Generate security reports
npm run security:report

# Validate encryption
npm run security:validate
```

### Performance Testing

```bash
# Run performance tests
npm run test:performance

# Generate performance reports
npm run performance:report

# Run concurrency tests
npm run test:concurrency
```

## Performance Targets

- Risk calculations: <100ms response time
- Trade execution: <50ms latency
- Cross-chain arbitrage: <1s opportunity window
- System uptime: 99.9% minimum
- Concurrent users: 10,000+

## Success Metrics

### Technical KPIs
- Portfolio returns: 15%+ annual average
- Maximum drawdown: <20%
- Win rate: >60% profitable strategies
- Risk-adjusted returns: Sharpe ratio >1.5

### Business KPIs
- User acquisition: 10K users Year 1, 100K users Year 2
- Assets under management: $100M within 18 months
- Revenue targets: $1M ARR Year 1, $10M ARR Year 2

## Contributing

1. Follow the Task Master workflow for all development
2. Ensure all tests pass before submitting PRs
3. Follow the established coding standards
4. Update documentation for new features

## License

[License details to be determined]

## Security

This project handles financial assets and user funds. Security is paramount:
- All smart contracts undergo formal verification
- Regular security audits by third parties
- Bug bounty program for responsible disclosure
- Multi-signature wallets with time-locks