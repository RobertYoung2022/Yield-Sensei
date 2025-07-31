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
## 🚀 Quick Setup

### Environment Configuration

1. **Run the setup script:**
   ```bash
   ./scripts/setup-env.sh
   ```

2. **Edit your API keys:**
   ```bash
   # Edit .env file with your actual API keys
   nano .env
   ```

3. **Restart Cursor IDE** to load the new MCP configuration

### Required API Keys

You'll need API keys for the AI providers you want to use:

- **Anthropic** (Claude): https://console.anthropic.com/
- **Perplexity**: https://www.perplexity.ai/settings/api
- **OpenAI**: https://platform.openai.com/api-keys
- **Google**: https://makersuite.google.com/app/apikey
- **OpenRouter**: https://openrouter.ai/keys
- **Mistral**: https://console.mistral.ai/
- **Azure OpenAI**: https://portal.azure.com/
- **Ollama**: Local installation (http://localhost:11434)

### AI Tools Integration

This project includes several AI tools:

- **Claude AI Assistant** (`.claude/`): Command templates and workflows
- **Taskmaster** (`.taskmaster/`): Task management and project planning
- **Serena AI** (`.serena/`): Project memories and context
- **Cursor IDE** (`.cursor/`): Development environment rules

All configuration files are tracked in git for easy setup across different machines.

