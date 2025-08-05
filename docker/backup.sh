#!/bin/bash

# AQI API Docker Backup Script
# This script creates backups of MongoDB and Redis data

set -e

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"
COMPRESSED_FILE="./backups/aqi_backup_$DATE.tar.gz"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if containers are running
check_containers() {
    if ! docker ps --format "table {{.Names}}" | grep -q "aqi-mongodb\|aqi-redis"; then
        warning "AQI containers are not running. Starting them..."
        docker-compose up -d mongodb redis
        sleep 10
    fi
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/mongodb"
    mkdir -p "$BACKUP_DIR/redis"
}

# Backup MongoDB
backup_mongodb() {
    log "Starting MongoDB backup..."
    
    if docker ps --format "table {{.Names}}" | grep -q "aqi-mongodb"; then
        # Create MongoDB dump
        docker exec aqi-mongodb mongodump --out /data/backup --quiet
        
        # Copy backup from container
        docker cp aqi-mongodb:/data/backup/. "$BACKUP_DIR/mongodb/"
        
        # Clean up backup in container
        docker exec aqi-mongodb rm -rf /data/backup
        
        log "MongoDB backup completed successfully"
    else
        error "MongoDB container is not running"
        return 1
    fi
}

# Backup Redis
backup_redis() {
    log "Starting Redis backup..."
    
    if docker ps --format "table {{.Names}}" | grep -q "aqi-redis"; then
        # Trigger Redis save
        docker exec aqi-redis redis-cli BGSAVE
        
        # Wait for save to complete
        sleep 5
        
        # Copy Redis dump file
        docker cp aqi-redis:/data/dump.rdb "$BACKUP_DIR/redis/"
        
        # Copy Redis configuration
        docker cp aqi-redis:/data/redis.conf "$BACKUP_DIR/redis/" 2>/dev/null || true
        
        log "Redis backup completed successfully"
    else
        error "Redis container is not running"
        return 1
    fi
}

# Backup application logs
backup_logs() {
    log "Backing up application logs..."
    
    if [ -d "./logs" ]; then
        cp -r ./logs "$BACKUP_DIR/"
        log "Application logs backed up"
    else
        warning "No logs directory found"
    fi
}

# Backup environment configuration
backup_config() {
    log "Backing up configuration files..."
    
    # Backup .env file if it exists
    if [ -f ".env" ]; then
        cp .env "$BACKUP_DIR/"
        log "Environment configuration backed up"
    fi
    
    # Backup docker-compose files
    cp docker-compose*.yml "$BACKUP_DIR/" 2>/dev/null || true
    cp Dockerfile "$BACKUP_DIR/" 2>/dev/null || true
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd backups
    tar -czf "../$COMPRESSED_FILE" "$DATE"
    cd ..
    
    # Remove uncompressed backup
    rm -rf "$BACKUP_DIR"
    
    log "Backup compressed: $COMPRESSED_FILE"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    find ./backups -name "aqi_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    log "Old backups cleaned up"
}

# Verify backup
verify_backup() {
    log "Verifying backup..."
    
    if [ -f "$COMPRESSED_FILE" ]; then
        # Check if file is not empty
        if [ -s "$COMPRESSED_FILE" ]; then
            log "Backup verification successful"
            log "Backup size: $(du -h "$COMPRESSED_FILE" | cut -f1)"
        else
            error "Backup file is empty"
            return 1
        fi
    else
        error "Backup file not found"
        return 1
    fi
}

# Main backup function
main() {
    log "Starting AQI API backup process..."
    
    # Pre-flight checks
    check_docker
    check_containers
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_mongodb
    backup_redis
    backup_logs
    backup_config
    
    # Compress and cleanup
    compress_backup
    cleanup_old_backups
    
    # Verify backup
    verify_backup
    
    log "Backup process completed successfully!"
    log "Backup location: $COMPRESSED_FILE"
}

# Restore function
restore() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        error "Please specify a backup file to restore"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log "Starting restore process from: $backup_file"
    
    # Create temporary directory
    local temp_dir=$(mktemp -d)
    
    # Extract backup
    log "Extracting backup..."
    tar -xzf "$backup_file" -C "$temp_dir"
    
    # Stop services
    log "Stopping services..."
    docker-compose down
    
    # Restore MongoDB
    if [ -d "$temp_dir/mongodb" ]; then
        log "Restoring MongoDB..."
        docker-compose up -d mongodb
        sleep 10
        docker exec aqi-mongodb mongorestore --drop /backup
        docker cp "$temp_dir/mongodb/." aqi-mongodb:/backup/
        log "MongoDB restored successfully"
    fi
    
    # Restore Redis
    if [ -f "$temp_dir/redis/dump.rdb" ]; then
        log "Restoring Redis..."
        docker-compose up -d redis
        sleep 5
        docker cp "$temp_dir/redis/dump.rdb" aqi-redis:/data/
        docker restart aqi-redis
        log "Redis restored successfully"
    fi
    
    # Restore logs
    if [ -d "$temp_dir/logs" ]; then
        log "Restoring logs..."
        cp -r "$temp_dir/logs" ./
    fi
    
    # Restore configuration
    if [ -f "$temp_dir/.env" ]; then
        log "Restoring configuration..."
        cp "$temp_dir/.env" ./
    fi
    
    # Clean up
    rm -rf "$temp_dir"
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    log "Restore process completed successfully!"
}

# Show usage
usage() {
    echo "AQI API Docker Backup Script"
    echo ""
    echo "Usage: $0 [backup|restore <file>|list]"
    echo ""
    echo "Commands:"
    echo "  backup    Create a new backup"
    echo "  restore   Restore from a backup file"
    echo "  list      List available backups"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore ./backups/aqi_backup_20240805_143022.tar.gz"
    echo "  $0 list"
}

# List backups
list_backups() {
    log "Available backups:"
    if [ -d "./backups" ]; then
        find ./backups -name "aqi_backup_*.tar.gz" -type f -exec ls -lh {} \; | sort -k6,7
    else
        warning "No backups directory found"
    fi
}

# Main script logic
case "${1:-backup}" in
    "backup")
        main
        ;;
    "restore")
        restore "$2"
        ;;
    "list")
        list_backups
        ;;
    *)
        usage
        exit 1
        ;;
esac 