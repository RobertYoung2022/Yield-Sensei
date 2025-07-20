# YieldSensei Core System

## Multi-Agent Orchestration Engine

The core system coordinates all 8 satellite systems and manages:

- Inter-satellite communication protocols
- Central coordination and scheduling
- Performance monitoring and optimization
- Security and compliance enforcement
- Data flow management
- Error handling and recovery

## Directory Structure
```
core/
├── orchestrator/   # Multi-agent coordination
├── communication/  # Inter-satellite messaging
├── scheduling/     # Task scheduling
├── monitoring/     # Performance monitoring
├── security/       # Core security systems
└── recovery/       # Error handling & recovery
```

## Technology Stack
- **Primary**: TypeScript/Rust for performance-critical components
- **Database**: PostgreSQL, ClickHouse, Redis
- **Messaging**: Apache Kafka
- **Monitoring**: Custom telemetry + OpenTelemetry