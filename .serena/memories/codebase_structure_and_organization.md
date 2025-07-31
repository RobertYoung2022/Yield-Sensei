# YieldSensei Codebase Structure and Organization

## Root Directory Structure
```
/
├── src/                    # Main application source code
├── tests/                  # Test suites organized by type
├── __mocks__/              # Jest mock files
├── .taskmaster/            # Task Master AI project management
├── scripts/                # Utility and deployment scripts
├── config/                 # Configuration files
├── docs/                   # Documentation
├── deployments/            # Deployment configurations
└── [config files]          # Package.json, tsconfig, etc.
```

## Source Code Organization (`src/`)
```
src/
├── core/                   # Core orchestration and messaging
├── satellites/             # 8 specialized satellite systems
├── shared/                 # Shared utilities and services
├── types/                  # TypeScript type definitions
├── config/                 # Application configuration
├── security/               # Security frameworks and validation
├── compliance/             # Regulatory compliance systems
├── auth/                   # Authentication and authorization
├── api/                    # REST API endpoints
├── graphql/                # GraphQL schema and resolvers
├── websocket/              # Real-time communication
├── integrations/           # External service integrations
├── utils/                  # Utility functions
├── testing/                # Testing utilities
└── index.ts                # Application entry point
```

## Satellite Systems (`src/satellites/`)
- **SAGE**: Logic and decision-making
- **FORGE**: Builder and construction tools
- **PULSE**: Growth and monitoring
- **AEGIS**: Security (implemented in Rust)
- **ECHO**: Sentiment analysis
- **FUEL**: Logistics and optimization
- **BRIDGE**: Cross-chain operations
- **ORACLE**: Data feeds and pricing

## Test Organization (`tests/`)
```
tests/
├── security/               # Security validation tests
│   ├── encryption/         # Encryption testing
│   ├── database/           # Database security
│   ├── testing/            # Security testing frameworks
│   └── environment/        # Environment security
├── integration/            # System integration tests
├── satellites/             # Satellite-specific tests
│   ├── bridge/             # Cross-chain testing
│   └── sage/               # RWA and logic testing
├── performance/            # Performance and load tests
└── e2e/                    # End-to-end testing
```

## Configuration and Infrastructure
- **Package Management**: npm with lock file
- **TypeScript**: Multiple tsconfig files for different build targets
- **Docker**: Container orchestration with docker-compose
- **Git Hooks**: Husky for pre-commit validation
- **Environment**: Multiple environment templates and validation

## Development Patterns
- **Modular Architecture**: Clear separation of concerns
- **Singleton Patterns**: Used for system managers and orchestrators
- **Event-Driven**: Extensive use of EventEmitter patterns
- **Dependency Injection**: Configuration-driven component initialization
- **Path Aliases**: Clean import paths using @ aliases