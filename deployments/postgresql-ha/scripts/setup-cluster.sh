#!/bin/bash

# YieldSensei PostgreSQL High Availability Cluster Setup Script
# This script sets up and manages the PostgreSQL HA cluster with Patroni

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log "Dependencies check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$PROJECT_DIR/config"
    mkdir -p "$PROJECT_DIR/scripts/hooks"
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/backups"
    mkdir -p "$PROJECT_DIR/health-checker"
    
    log "Directories created successfully"
}

# Generate environment file with secure passwords
generate_env_file() {
    if [[ -f "$ENV_FILE" ]]; then
        warning "Environment file already exists. Skipping generation."
        return
    fi
    
    log "Generating environment file with secure passwords..."
    
    # Generate secure passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    POSTGRES_REPLICATION_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    ETCD_TOKEN=$(openssl rand -hex 16)
    
    cat > "$ENV_FILE" << EOF
# YieldSensei PostgreSQL HA Environment Configuration
# Generated on $(date)

# PostgreSQL Configuration
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_REPLICATION_PASSWORD=${POSTGRES_REPLICATION_PASSWORD}

# Monitoring and Alerting
ALERT_WEBHOOK_URL=
SLACK_WEBHOOK_URL=

# etcd Configuration
ETCD_TOKEN=${ETCD_TOKEN}

# Backup Configuration
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=6

# HAProxy Configuration
HAPROXY_STATS_USER=admin
HAPROXY_STATS_PASSWORD=yieldsensei-stats

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30
REPLICATION_LAG_THRESHOLD=10
FAILOVER_THRESHOLD=60

# Development/Testing (set to false in production)
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
EOF
    
    log "Environment file generated at $ENV_FILE"
    warning "Please review and update the environment variables as needed!"
}

# Initialize the PostgreSQL cluster
init_cluster() {
    log "Initializing PostgreSQL HA cluster..."
    
    # Start etcd cluster first
    info "Starting etcd cluster..."
    docker-compose -f "$COMPOSE_FILE" up -d etcd1 etcd2 etcd3
    
    # Wait for etcd to be ready
    info "Waiting for etcd cluster to be ready..."
    sleep 10
    
    # Check etcd health
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec etcd1 etcdctl --endpoints=http://etcd1:2379,http://etcd2:2379,http://etcd3:2379 endpoint health; then
            log "etcd cluster is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            error "etcd cluster failed to start properly"
            exit 1
        fi
        sleep 5
    done
    
    # Start PostgreSQL primary node
    info "Starting PostgreSQL primary node..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres-primary
    
    # Wait for primary to be ready
    info "Waiting for primary node to be ready..."
    sleep 20
    
    # Check primary health
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec postgres-primary pg_isready -h localhost -p 5432 -U yieldsensei_app; then
            log "Primary PostgreSQL node is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Primary PostgreSQL node failed to start properly"
            exit 1
        fi
        sleep 5
    done
    
    # Start replica nodes
    info "Starting PostgreSQL replica nodes..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres-replica1 postgres-replica2
    
    # Wait for replicas to be ready
    info "Waiting for replica nodes to be ready..."
    sleep 30
    
    # Start remaining services
    info "Starting HAProxy, PgBouncer, and monitoring services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log "PostgreSQL HA cluster initialization complete!"
}

# Check cluster status
status() {
    log "Checking PostgreSQL HA cluster status..."
    
    echo
    info "=== Container Status ==="
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo
    info "=== etcd Cluster Status ==="
    if docker-compose -f "$COMPOSE_FILE" exec etcd1 etcdctl --endpoints=http://etcd1:2379,http://etcd2:2379,http://etcd3:2379 endpoint health; then
        log "etcd cluster is healthy"
    else
        error "etcd cluster has issues"
    fi
    
    echo
    info "=== Patroni Cluster Status ==="
    if docker-compose -f "$COMPOSE_FILE" exec postgres-primary patronictl -c /etc/patroni/patroni.yml list; then
        log "Patroni cluster information retrieved"
    else
        warning "Unable to get Patroni cluster status"
    fi
    
    echo
    info "=== PostgreSQL Connection Test ==="
    if docker-compose -f "$COMPOSE_FILE" exec postgres-primary pg_isready -h localhost -p 5432 -U yieldsensei_app; then
        log "PostgreSQL primary is accepting connections"
    else
        error "PostgreSQL primary is not ready"
    fi
    
    echo
    info "=== HAProxy Status ==="
    echo "HAProxy stats available at: http://localhost:8404/stats"
    echo "Username: admin, Password: yieldsensei-stats"
    
    echo
    info "=== PgBouncer Status ==="
    if docker-compose -f "$COMPOSE_FILE" exec pgbouncer pg_isready -h localhost -p 6432 -d pgbouncer; then
        log "PgBouncer is ready"
    else
        warning "PgBouncer is not ready"
    fi
}

# Perform manual failover
failover() {
    local target_node=${1:-}
    
    if [[ -z "$target_node" ]]; then
        error "Please specify target node for failover (postgres-replica1 or postgres-replica2)"
        exit 1
    fi
    
    warning "Performing manual failover to $target_node..."
    warning "This will promote $target_node to primary. Continue? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log "Initiating failover to $target_node..."
        docker-compose -f "$COMPOSE_FILE" exec "$target_node" patronictl -c /etc/patroni/patroni.yml failover --master postgres-primary --candidate "$target_node"
        log "Failover completed. Check cluster status for verification."
    else
        info "Failover cancelled."
    fi
}

# Create backup
backup() {
    log "Creating manual backup..."
    
    BACKUP_NAME="manual_backup_$(date +%Y%m%d_%H%M%S)"
    
    if docker-compose -f "$COMPOSE_FILE" exec postgres-primary pg_dump -h localhost -U yieldsensei_app -d yieldsensei > "/tmp/$BACKUP_NAME.sql"; then
        log "Backup created successfully: $BACKUP_NAME.sql"
    else
        error "Backup failed"
        exit 1
    fi
}

# Restore from backup
restore() {
    local backup_file=${1:-}
    
    if [[ -z "$backup_file" ]]; then
        error "Please specify backup file to restore from"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi
    
    warning "This will restore the database from $backup_file. All current data will be lost!"
    warning "Continue? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log "Restoring database from $backup_file..."
        
        # Stop the cluster
        docker-compose -f "$COMPOSE_FILE" stop postgres-primary postgres-replica1 postgres-replica2
        
        # Remove old data
        docker volume rm yieldsensei-postgres-primary-data yieldsensei-postgres-replica1-data yieldsensei-postgres-replica2-data || true
        
        # Start primary only
        docker-compose -f "$COMPOSE_FILE" up -d postgres-primary
        
        # Wait for primary to be ready
        sleep 20
        
        # Restore data
        docker-compose -f "$COMPOSE_FILE" exec -T postgres-primary psql -h localhost -U yieldsensei_app -d yieldsensei < "$backup_file"
        
        # Restart replicas
        docker-compose -f "$COMPOSE_FILE" up -d postgres-replica1 postgres-replica2
        
        log "Restore completed successfully"
    else
        info "Restore cancelled."
    fi
}

# Show logs
logs() {
    local service=${1:-}
    
    if [[ -z "$service" ]]; then
        info "Available services: etcd1, etcd2, etcd3, postgres-primary, postgres-replica1, postgres-replica2, haproxy, pgbouncer, postgres-exporter"
        docker-compose -f "$COMPOSE_FILE" logs --tail=50 -f
    else
        docker-compose -f "$COMPOSE_FILE" logs --tail=50 -f "$service"
    fi
}

# Cleanup cluster
cleanup() {
    warning "This will stop and remove all containers and volumes. Continue? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log "Cleaning up PostgreSQL HA cluster..."
        docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans
        log "Cleanup completed"
    else
        info "Cleanup cancelled."
    fi
}

# Show usage
usage() {
    echo "YieldSensei PostgreSQL HA Cluster Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  init      Initialize the PostgreSQL HA cluster"
    echo "  status    Show cluster status and health"
    echo "  failover  Perform manual failover [target-node]"
    echo "  backup    Create manual backup"
    echo "  restore   Restore from backup [backup-file]"
    echo "  logs      Show logs [service-name]"
    echo "  cleanup   Stop and remove all containers and volumes"
    echo "  help      Show this usage information"
    echo ""
    echo "Examples:"
    echo "  $0 init                                    # Initialize cluster"
    echo "  $0 status                                  # Check status"
    echo "  $0 failover postgres-replica1              # Failover to replica1"
    echo "  $0 backup                                  # Create backup"
    echo "  $0 restore /path/to/backup.sql            # Restore from backup"
    echo "  $0 logs postgres-primary                   # Show primary logs"
    echo "  $0 cleanup                                 # Clean up everything"
}

# Main function
main() {
    check_dependencies
    create_directories
    
    case "${1:-help}" in
        init)
            generate_env_file
            init_cluster
            ;;
        status)
            status
            ;;
        failover)
            failover "${2:-}"
            ;;
        backup)
            backup
            ;;
        restore)
            restore "${2:-}"
            ;;
        logs)
            logs "${2:-}"
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            error "Unknown command: ${1:-}"
            echo ""
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 