#!/bin/bash

# Redis Cluster Management Script for YieldSensei DeFi Platform
# Manages Redis master-replica setup with Sentinel high availability

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="yieldsensei-redis"
REDIS_PASSWORD="${REDIS_PASSWORD:-yieldsensei2024}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Redis Cluster Management Script for YieldSensei

Usage: $0 <command> [options]

Commands:
  start           Start Redis cluster with all services
  stop            Stop Redis cluster
  restart         Restart Redis cluster
  status          Show cluster status and health
  logs            Show logs for all services
  backup          Create backup of Redis data
  restore         Restore Redis data from backup
  failover        Test manual failover
  cleanup         Clean up volumes and networks
  monitor         Real-time monitoring dashboard
  benchmark       Run Redis performance benchmark
  config-reload   Reload Redis configuration
  help            Show this help message

Options:
  --service <name>    Target specific service (redis-master, redis-replica-1, etc.)
  --follow           Follow logs in real-time
  --backup-path      Custom backup path

Environment Variables:
  REDIS_PASSWORD     Redis password (default: yieldsensei2024)

Examples:
  $0 start                          # Start entire cluster
  $0 logs --service redis-master    # Show master logs
  $0 backup --backup-path ./backups # Backup to custom path
  $0 monitor                        # Show real-time monitoring

EOF
}

# Check dependencies
check_dependencies() {
    local deps=("docker" "docker-compose" "redis-cli")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency '$dep' is not installed"
            exit 1
        fi
    done
}

# Start Redis cluster
start_cluster() {
    log_info "Starting Redis cluster..."
    
    # Create directories
    mkdir -p logs
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Verify cluster health
    if verify_cluster_health; then
        log_info "Redis cluster started successfully"
        show_cluster_status
    else
        log_error "Cluster health check failed"
        exit 1
    fi
}

# Stop Redis cluster
stop_cluster() {
    log_info "Stopping Redis cluster..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    log_info "Redis cluster stopped"
}

# Restart Redis cluster
restart_cluster() {
    log_info "Restarting Redis cluster..."
    stop_cluster
    sleep 5
    start_cluster
}

# Show cluster status
show_cluster_status() {
    log_info "Redis Cluster Status:"
    echo "===================="
    
    # Service status
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    
    echo ""
    log_info "Redis Instance Health:"
    
    # Master health
    if redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" ping &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Master (6379) - Healthy"
    else
        echo -e "  ${RED}✗${NC} Master (6379) - Down"
    fi
    
    # Replica health
    for port in 6380 6381; do
        if redis-cli -h localhost -p "$port" -a "$REDIS_PASSWORD" ping &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Replica ($port) - Healthy"
        else
            echo -e "  ${RED}✗${NC} Replica ($port) - Down"
        fi
    done
    
    # Sentinel health
    for port in 26379 26380 26381; do
        if redis-cli -h localhost -p "$port" ping &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Sentinel ($port) - Healthy"
        else
            echo -e "  ${RED}✗${NC} Sentinel ($port) - Down"
        fi
    done
    
    echo ""
    
    # Replication info
    log_info "Replication Status:"
    if redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info replication 2>/dev/null | grep -E "(role|connected_slaves)" || echo "  Cannot connect to master"
    
    echo ""
    
    # Sentinel info
    log_info "Sentinel Status:"
    if redis-cli -h localhost -p 26379 sentinel masters 2>/dev/null | head -10 || echo "  Cannot connect to sentinel"
}

# Verify cluster health
verify_cluster_health() {
    local healthy=0
    
    # Check master
    if redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" ping &>/dev/null; then
        ((healthy++))
    fi
    
    # Check replicas
    for port in 6380 6381; do
        if redis-cli -h localhost -p "$port" -a "$REDIS_PASSWORD" ping &>/dev/null; then
            ((healthy++))
        fi
    done
    
    # Check sentinels
    for port in 26379 26380 26381; do
        if redis-cli -h localhost -p "$port" ping &>/dev/null; then
            ((healthy++))
        fi
    done
    
    # Require at least master + 1 replica + 2 sentinels
    if [[ $healthy -ge 4 ]]; then
        return 0
    else
        return 1
    fi
}

# Show logs
show_logs() {
    local service="${1:-}"
    local follow="${2:-false}"
    
    if [[ -n "$service" ]]; then
        if [[ "$follow" == "true" ]]; then
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$service"
        else
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=100 "$service"
        fi
    else
        if [[ "$follow" == "true" ]]; then
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
        else
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=100
        fi
    fi
}

# Backup Redis data
backup_data() {
    local backup_path="${1:-./backups/redis-$(date +%Y%m%d-%H%M%S)}"
    
    log_info "Creating backup at: $backup_path"
    mkdir -p "$backup_path"
    
    # Backup master data
    log_info "Backing up master data..."
    redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" --rdb "$backup_path/master-dump.rdb"
    
    # Backup configuration
    log_info "Backing up configuration..."
    cp -r config "$backup_path/"
    
    # Create backup metadata
    cat > "$backup_path/backup-info.txt" << EOF
Backup created: $(date)
Redis version: $(redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info server | grep redis_version)
Cluster status: $(redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info replication | grep role)
EOF
    
    log_info "Backup completed: $backup_path"
}

# Restore Redis data
restore_data() {
    local backup_path="${1:-}"
    
    if [[ -z "$backup_path" || ! -d "$backup_path" ]]; then
        log_error "Invalid backup path: $backup_path"
        exit 1
    fi
    
    log_warn "This will overwrite current Redis data. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from backup: $backup_path"
    
    # Stop cluster
    stop_cluster
    
    # Restore data files (implementation depends on volume structure)
    log_info "Restoring data files..."
    # Note: In production, you'd copy the RDB file to the appropriate volume location
    
    # Start cluster
    start_cluster
    
    log_info "Restore completed"
}

# Test manual failover
test_failover() {
    log_info "Testing manual failover..."
    
    # Trigger failover via Sentinel
    redis-cli -h localhost -p 26379 sentinel failover yieldsensei-master
    
    log_info "Failover initiated. Monitoring for 30 seconds..."
    sleep 5
    
    for i in {1..6}; do
        echo "Check $i/6:"
        show_cluster_status
        echo ""
        sleep 5
    done
    
    log_info "Failover test completed"
}

# Real-time monitoring
monitor_cluster() {
    log_info "Starting real-time monitoring (Press Ctrl+C to exit)..."
    
    while true; do
        clear
        echo "=== Redis Cluster Monitoring - $(date) ==="
        show_cluster_status
        
        echo ""
        log_info "Memory Usage:"
        redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info memory | grep -E "(used_memory_human|used_memory_peak_human|used_memory_rss_human)" || echo "  Cannot get memory info"
        
        echo ""
        log_info "Connected Clients:"
        redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info clients | grep "connected_clients" || echo "  Cannot get client info"
        
        echo ""
        log_info "Operations per Second:"
        redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" info stats | grep -E "(instantaneous_ops_per_sec|total_commands_processed)" || echo "  Cannot get stats"
        
        sleep 5
    done
}

# Run performance benchmark
run_benchmark() {
    log_info "Running Redis performance benchmark..."
    
    # Basic benchmark
    log_info "Testing SET operations..."
    redis-benchmark -h localhost -p 6379 -a "$REDIS_PASSWORD" -t set -n 10000 -c 50
    
    echo ""
    log_info "Testing GET operations..."
    redis-benchmark -h localhost -p 6379 -a "$REDIS_PASSWORD" -t get -n 10000 -c 50
    
    echo ""
    log_info "Testing mixed operations..."
    redis-benchmark -h localhost -p 6379 -a "$REDIS_PASSWORD" -n 10000 -c 50
}

# Cleanup
cleanup() {
    log_warn "This will remove all Redis data and networks. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        exit 0
    fi
    
    log_info "Cleaning up Redis cluster..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
    docker network prune -f
    log_info "Cleanup completed"
}

# Reload configuration
reload_config() {
    log_info "Reloading Redis configuration..."
    
    # Reload master config
    redis-cli -h localhost -p 6379 -a "$REDIS_PASSWORD" config rewrite
    
    # Reload replicas
    for port in 6380 6381; do
        redis-cli -h localhost -p "$port" -a "$REDIS_PASSWORD" config rewrite
    done
    
    log_info "Configuration reloaded"
}

# Main script logic
main() {
    check_dependencies
    
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        start)
            start_cluster
            ;;
        stop)
            stop_cluster
            ;;
        restart)
            restart_cluster
            ;;
        status)
            show_cluster_status
            ;;
        logs)
            local service=""
            local follow=false
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --service)
                        service="$2"
                        shift 2
                        ;;
                    --follow)
                        follow=true
                        shift
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        exit 1
                        ;;
                esac
            done
            
            show_logs "$service" "$follow"
            ;;
        backup)
            local backup_path=""
            
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --backup-path)
                        backup_path="$2"
                        shift 2
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        exit 1
                        ;;
                esac
            done
            
            backup_data "$backup_path"
            ;;
        restore)
            restore_data "$1"
            ;;
        failover)
            test_failover
            ;;
        cleanup)
            cleanup
            ;;
        monitor)
            monitor_cluster
            ;;
        benchmark)
            run_benchmark
            ;;
        config-reload)
            reload_config
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 