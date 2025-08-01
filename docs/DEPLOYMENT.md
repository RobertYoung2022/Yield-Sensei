# SnikDis Crypto Deployment Guide
## Your DeFi, Your Way: Powered by SnikDis Crypto

This guide provides comprehensive instructions for deploying SnikDis Crypto in production environments, ensuring security, scalability, and reliability for your AI-powered DeFi portfolio management platform.

## 🚀 **Quick Start**

### **Prerequisites**
- **Docker & Docker Compose** - Container orchestration
- **Kubernetes** (optional) - Production orchestration
- **PostgreSQL 14+** - Primary database
- **Redis 6+** - Caching and session management
- **ClickHouse 22+** - Analytics database
- **Qdrant 1.0+** - Vector database for AI operations

### **Environment Setup**
```bash
# Clone SnikDis Crypto
git clone https://github.com/snikdis/snikdis-crypto.git
cd snikdis-crypto

# Copy environment template
cp .env.template .env

# Configure environment variables
nano .env
```

## 🔧 **Configuration**

### **Environment Variables**

#### **Core Configuration**
```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=snikdis_prod
POSTGRES_USER=snikdis_user
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=9000
CLICKHOUSE_DB=snikdis_analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_clickhouse_password

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your_qdrant_api_key
```

#### **AI Provider Configuration**
```bash
# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Perplexity
PERPLEXITY_API_KEY=your_perplexity_key

# Google AI
GOOGLE_API_KEY=your_google_key
GOOGLE_MODEL=gemini-pro

# Mistral AI
MISTRAL_API_KEY=your_mistral_key
MISTRAL_MODEL=mistral-large-latest

# Azure OpenAI
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint
AZURE_OPENAI_MODEL=gpt-4

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-3-sonnet

# XAI
XAI_API_KEY=your_xai_key
XAI_MODEL=x-1

# Ollama
OLLAMA_API_KEY=your_ollama_key
OLLAMA_BASE_URL=http://localhost:11434
```

#### **Security Configuration**
```bash
# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Encryption
ENCRYPTION_KEY=your_encryption_key
ENCRYPTION_ALGORITHM=aes-256-gcm

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://app.snikdis.com
CORS_CREDENTIALS=true
```

#### **External Services**
```bash
# Blockchain RPC
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
POLYGON_RPC_URL=https://polygon-rpc.com
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
JAEGER_PORT=16686

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## 🐳 **Docker Deployment**

### **Development Environment**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### **Production Environment**
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale api=3
```

### **Docker Compose Configuration**

#### **Development (docker-compose.yml)**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: snikdis_dev
      POSTGRES_USER: snikdis_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U snikdis_user -d snikdis_dev"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ClickHouse Analytics
  clickhouse:
    image: clickhouse/clickhouse-server:22.8
    ports:
      - "9000:9000"
      - "8123:8123"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./deployments/clickhouse/config:/etc/clickhouse-server/config.d
      - ./deployments/clickhouse/schemas:/docker-entrypoint-initdb.d
    environment:
      CLICKHOUSE_DB: snikdis_analytics
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: clickhouse_password

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
      - ./deployments/qdrant/config:/qdrant/config
    environment:
      QDRANT__SERVICE__HTTP_PORT: 6333
      QDRANT__SERVICE__GRPC_PORT: 6334

  # Kafka Message Bus
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  # SnikDis Crypto API
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
      CLICKHOUSE_HOST: clickhouse
      QDRANT_HOST: qdrant
      KAFKA_HOST: kafka
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_started
      qdrant:
        condition: service_started
      kafka:
        condition: service_started
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

  # Prometheus Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  # Grafana Dashboard
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning

volumes:
  postgres_data:
  redis_data:
  clickhouse_data:
  qdrant_data:
  prometheus_data:
  grafana_data:
```

#### **Production (docker-compose.prod.yml)**
```yaml
version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - nginx_logs:/var/log/nginx
    depends_on:
      - api

  # SnikDis Crypto API (Multiple Instances)
  api:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      REDIS_HOST: redis
      CLICKHOUSE_HOST: clickhouse
      QDRANT_HOST: qdrant
      KAFKA_HOST: kafka
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

  # PostgreSQL (Production)
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: snikdis_prod
      POSTGRES_USER: snikdis_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./deployments/postgresql-ha/backup:/backup
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U snikdis_user -d snikdis_prod"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # Redis Cluster
  redis-master:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_master_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis-replica:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379 --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_replica_data:/data
    depends_on:
      - redis-master

  # ClickHouse Cluster
  clickhouse-server:
    image: clickhouse/clickhouse-server:22.8
    environment:
      CLICKHOUSE_DB: snikdis_analytics
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./deployments/clickhouse/config:/etc/clickhouse-server/config.d
      - ./deployments/clickhouse/schemas:/docker-entrypoint-initdb.d
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_data:/qdrant/storage
      - ./deployments/qdrant/config:/qdrant/config
    environment:
      QDRANT__SERVICE__HTTP_PORT: 6333
      QDRANT__SERVICE__GRPC_PORT: 6334
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

volumes:
  postgres_data:
    driver: local
  redis_master_data:
    driver: local
  redis_replica_data:
    driver: local
  clickhouse_data:
    driver: local
  qdrant_data:
    driver: local
  nginx_logs:
    driver: local
```

## ☸️ **Kubernetes Deployment**

### **Prerequisites**
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Create namespace
kubectl create namespace snikdis
```

### **Helm Chart Deployment**
```bash
# Add Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install PostgreSQL
helm install postgres bitnami/postgresql \
  --namespace snikdis \
  --set auth.postgresPassword=your_secure_password \
  --set auth.database=snikdis_prod \
  --set primary.persistence.size=100Gi

# Install Redis
helm install redis bitnami/redis \
  --namespace snikdis \
  --set auth.password=your_redis_password \
  --set master.persistence.size=50Gi

# Install ClickHouse
helm install clickhouse bitnami/clickhouse \
  --namespace snikdis \
  --set auth.password=your_clickhouse_password \
  --set persistence.size=200Gi

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace snikdis \
  --set grafana.enabled=true \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi

# Deploy SnikDis Crypto
helm install snikdis ./helm/snikdis \
  --namespace snikdis \
  --set environment=production \
  --set replicas=3
```

### **Kubernetes Manifests**

#### **ConfigMap**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: snikdis-config
  namespace: snikdis
data:
  NODE_ENV: "production"
  API_VERSION: "v1"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  CORS_ORIGIN: "https://app.snikdis.com"
  CORS_CREDENTIALS: "true"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

#### **Secret**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: snikdis-secrets
  namespace: snikdis
type: Opaque
data:
  JWT_SECRET: <base64-encoded-jwt-secret>
  ENCRYPTION_KEY: <base64-encoded-encryption-key>
  POSTGRES_PASSWORD: <base64-encoded-postgres-password>
  REDIS_PASSWORD: <base64-encoded-redis-password>
  CLICKHOUSE_PASSWORD: <base64-encoded-clickhouse-password>
  OPENAI_API_KEY: <base64-encoded-openai-key>
  ANTHROPIC_API_KEY: <base64-encoded-anthropic-key>
  PERPLEXITY_API_KEY: <base64-encoded-perplexity-key>
```

#### **Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: snikdis-api
  namespace: snikdis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: snikdis-api
  template:
    metadata:
      labels:
        app: snikdis-api
    spec:
      containers:
      - name: snikdis-api
        image: snikdis/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: snikdis-config
        - secretRef:
            name: snikdis-secrets
        env:
        - name: POSTGRES_HOST
          value: "postgres"
        - name: REDIS_HOST
          value: "redis"
        - name: CLICKHOUSE_HOST
          value: "clickhouse"
        - name: QDRANT_HOST
          value: "qdrant"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### **Service**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: snikdis-api-service
  namespace: snikdis
spec:
  selector:
    app: snikdis-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

#### **Ingress**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: snikdis-ingress
  namespace: snikdis
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.snikdis.com
    secretName: snikdis-tls
  rules:
  - host: api.snikdis.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: snikdis-api-service
            port:
              number: 80
```

## 🔒 **Security Configuration**

### **SSL/TLS Setup**
```bash
# Generate SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/snikdis.key \
  -out nginx/ssl/snikdis.crt \
  -subj "/C=US/ST=State/L=City/O=SnikDis/CN=api.snikdis.com"
```

### **Nginx Configuration**
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream snikdis_api {
        server api:3000;
    }

    server {
        listen 80;
        server_name api.snikdis.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.snikdis.com;

        ssl_certificate /etc/nginx/ssl/snikdis.crt;
        ssl_certificate_key /etc/nginx/ssl/snikdis.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        limit_req zone=api burst=20 nodelay;

        location / {
            proxy_pass http://snikdis_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### **Firewall Configuration**
```bash
# UFW Firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 5432/tcp
sudo ufw allow 6379/tcp
sudo ufw allow 9000/tcp
sudo ufw allow 6333/tcp
sudo ufw allow 9090/tcp
sudo ufw allow 3001/tcp
```

## 📊 **Monitoring & Observability**

### **Prometheus Configuration**
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'snikdis-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'clickhouse'
    static_configs:
      - targets: ['clickhouse:9000']

  - job_name: 'qdrant'
    static_configs:
      - targets: ['qdrant:6333']
```

### **Grafana Dashboards**
```json
{
  "dashboard": {
    "title": "SnikDis Crypto - System Overview",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "{{datname}}"
          }
        ]
      },
      {
        "title": "Satellite Health",
        "type": "stat",
        "targets": [
          {
            "expr": "snikdis_satellite_health",
            "legendFormat": "{{satellite}}"
          }
        ]
      }
    ]
  }
}
```

### **Alert Rules**
```yaml
# monitoring/alert_rules.yml
groups:
  - name: snikdis_alerts
    rules:
      - alert: HighResponseTime
        expr: rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time"
          description: "Average response time is {{ $value }}s"

      - alert: DatabaseConnectionHigh
        expr: pg_stat_database_numbackends > 80
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High database connections"
          description: "Database has {{ $value }} active connections"

      - alert: SatelliteDown
        expr: snikdis_satellite_health == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Satellite is down"
          description: "Satellite {{ $labels.satellite }} is not responding"
```

## 🔄 **CI/CD Pipeline**

### **GitHub Actions**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'snikdis/api:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: snikdis/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Kubernetes
        uses: steebchen/kubectl@v2
        with:
          config: ${{ secrets.KUBE_CONFIG_DATA }}
          command: set image deployment/snikdis-api snikdis-api=snikdis/api:latest -n snikdis
```

## 🚀 **Performance Optimization**

### **Database Optimization**
```sql
-- PostgreSQL Optimization
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- ClickHouse Optimization
ALTER TABLE snikdis_analytics.events 
SETTINGS merge_tree_parts_to_delay_insert = 150, 
         merge_tree_parts_to_throw_insert = 300;
```

### **Application Optimization**
```typescript
// Connection pooling
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis optimization
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});
```

## 🔧 **Backup & Recovery**

### **Database Backup**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup"

# PostgreSQL backup
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# ClickHouse backup
clickhouse-client --host $CLICKHOUSE_HOST --port $CLICKHOUSE_PORT \
  --user $CLICKHOUSE_USER --password $CLICKHOUSE_PASSWORD \
  --query "BACKUP TABLE snikdis_analytics.events TO '/backup/clickhouse_$DATE'"

# Qdrant backup
curl -X POST "http://$QDRANT_HOST:6333/collections/backup" \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"/backup/qdrant_$DATE\"}"

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
find $BACKUP_DIR -name "clickhouse_*" -mtime +30 -delete
find $BACKUP_DIR -name "qdrant_*" -mtime +30 -delete
```

### **Automated Backup Cron**
```bash
# Add to crontab
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

## 📋 **Health Checks**

### **Application Health Endpoints**
```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    // Check satellite health
    const satelliteHealth = await checkSatelliteHealth();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      satellites: satelliteHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

## 🔗 **Support & Resources**

### **Documentation**
- **Deployment Guide**: [docs.snikdis.com/deployment](https://docs.snikdis.com/deployment)
- **API Documentation**: [docs.snikdis.com/api](https://docs.snikdis.com/api)
- **Troubleshooting**: [docs.snikdis.com/troubleshooting](https://docs.snikdis.com/troubleshooting)

### **Support**
- **Technical Support**: tech-support@snikdis.com
- **Deployment Support**: deployment-support@snikdis.com
- **Emergency Contact**: emergency@snikdis.com

### **Monitoring**
- **Status Page**: [status.snikdis.com](https://status.snikdis.com)
- **Grafana Dashboard**: [grafana.snikdis.com](https://grafana.snikdis.com)
- **Prometheus Metrics**: [metrics.snikdis.com](https://metrics.snikdis.com)

---

**SnikDis Crypto** - Your DeFi, Your Way: Powered by SnikDis Crypto

*Transform your DeFi experience with AI-driven simplicity.* 