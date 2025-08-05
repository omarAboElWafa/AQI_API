# Docker Guide for AQI API

This guide provides comprehensive instructions for running the AQI API application using Docker and Docker Compose.

## 🐳 Overview

The application is fully containerized with the following services:
- **aqi-api**: NestJS application
- **mongodb**: Database for air quality data
- **redis**: Cache and queue management
- **mongo-express**: MongoDB web interface (optional)
- **redis-commander**: Redis web interface (optional)
- **bull-board**: Queue management interface (optional)

## 📋 Prerequisites

1. **Docker** (v20.10 or higher)
2. **Docker Compose** (v2.0 or higher)
3. **IQAir API Key** (Get from https://www.iqair.com/air-pollution-data-api)

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```bash
# Copy the example environment file
cp env.example .env
```

Edit `.env` with your settings:
```env
# Required
IQAIR_API_KEY=your_iqair_api_key_here

# Optional (defaults provided)
ADMIN_API_KEY=your_admin_api_key_here
NODE_ENV=production
PORT=3000
```

### 2. Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f aqi-api

# Check service status
docker-compose ps
```

### 3. Development Mode

```bash
# Start development environment with additional tools
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f aqi-api-dev
```

## 🔧 Service Management

### Start Services
```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up -d
```

### Stop Services
```bash
# Production
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml down
```

### Restart Services
```bash
# Production
docker-compose restart

# Development
docker-compose -f docker-compose.dev.yml restart
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f aqi-api

# Development
docker-compose -f docker-compose.dev.yml logs -f aqi-api-dev
```

### Rebuild Services
```bash
# Production
docker-compose up -d --build

# Development
docker-compose -f docker-compose.dev.yml up -d --build
```

## 🌐 Access Points

### Application Services
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/analytics/health

### Management Tools (Development)
- **MongoDB Express**: http://localhost:8081 (admin/admin123)
- **Redis Commander**: http://localhost:8082
- **Bull Board**: http://localhost:8083

### Database Connections
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379 (password: redis123)

## 📊 Monitoring

### Health Checks
```bash
# Check all services health
docker-compose ps

# Check specific service
docker inspect aqi-api --format='{{.State.Health.Status}}'
```

### Resource Usage
```bash
# View resource usage
docker stats

# View disk usage
docker system df
```

## 🗄️ Database Management

### MongoDB Operations
```bash
# Connect to MongoDB
docker exec -it aqi-mongodb mongosh

# Backup database
docker exec aqi-mongodb mongodump --out /data/backup

# Restore database
docker exec aqi-mongodb mongorestore /data/backup
```

### Redis Operations
```bash
# Connect to Redis
docker exec -it aqi-redis redis-cli

# Monitor Redis
docker exec -it aqi-redis redis-cli monitor
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check if ports are in use
netstat -tulpn | grep :3000
netstat -tulpn | grep :27017
netstat -tulpn | grep :6379

# Stop conflicting services
sudo systemctl stop mongod
sudo systemctl stop redis
```

#### 2. Permission Issues
```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./logs
sudo chmod -R 755 ./logs
```

#### 3. Memory Issues
```bash
# Check available memory
free -h

# Increase Docker memory limit
# Edit Docker Desktop settings or docker daemon config
```

#### 4. Network Issues
```bash
# Check network connectivity
docker network ls
docker network inspect aqi-network

# Recreate network
docker-compose down
docker network prune
docker-compose up -d
```

### Debug Commands

#### Application Debugging
```bash
# View application logs
docker-compose logs -f aqi-api

# Execute commands in container
docker exec -it aqi-api sh

# Check application health
curl http://localhost:3000/api/analytics/health
```

#### Database Debugging
```bash
# Check MongoDB status
docker exec aqi-mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis status
docker exec aqi-redis redis-cli ping

# View database logs
docker-compose logs mongodb
docker-compose logs redis
```

#### Network Debugging
```bash
# Check container networking
docker exec aqi-api ping mongodb
docker exec aqi-api ping redis

# View network configuration
docker exec aqi-api cat /etc/hosts
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IQAIR_API_KEY` | IQAir API key (required) | - |
| `ADMIN_API_KEY` | Admin API key | `admin-api-key` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Application port | `3000` |
| `MONGODB_URI` | MongoDB connection | `mongodb://mongodb:27017/aqi_monitoring` |
| `REDIS_HOST` | Redis host | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `CACHE_TTL` | Cache TTL in seconds | `3600` |

### Volume Mounts

| Service | Volume | Purpose |
|---------|--------|---------|
| `aqi-api` | `./logs:/app/logs` | Application logs |
| `mongodb` | `mongodb_data:/data/db` | Database persistence |
| `redis` | `redis_data:/data` | Cache persistence |

## 🚀 Production Deployment

### 1. Production Environment
```bash
# Set production environment
export NODE_ENV=production

# Start production services
docker-compose up -d
```

### 2. SSL/TLS Setup
```bash
# Add SSL certificates
mkdir -p ./ssl
# Copy your certificates to ./ssl/

# Update docker-compose.yml to include SSL configuration
```

### 3. Reverse Proxy (Nginx)
```nginx
# Example nginx configuration
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Monitoring Setup
```bash
# Add monitoring services to docker-compose.yml
# - Prometheus for metrics
# - Grafana for visualization
# - AlertManager for alerts
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        run: |
          docker-compose pull
          docker-compose up -d
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale API service
docker-compose up -d --scale aqi-api=3

# Scale with load balancer
# Add nginx or traefik for load balancing
```

### Vertical Scaling
```bash
# Update docker-compose.yml with resource limits
services:
  aqi-api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 🧹 Maintenance

### Regular Maintenance
```bash
# Clean up unused images
docker image prune

# Clean up unused volumes
docker volume prune

# Clean up unused networks
docker network prune

# Full cleanup
docker system prune -a
```

### Backup Strategy
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec aqi-mongodb mongodump --out /data/backup
docker cp aqi-mongodb:/data/backup $BACKUP_DIR/mongodb

# Backup Redis
docker exec aqi-redis redis-cli BGSAVE
docker cp aqi-redis:/data/dump.rdb $BACKUP_DIR/redis/

# Compress backup
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR
```

## 🎯 Performance Optimization

### Docker Optimizations
```dockerfile
# Multi-stage build for smaller images
# Use .dockerignore to exclude unnecessary files
# Use specific base image versions
# Minimize layers
```

### Application Optimizations
```typescript
// Enable compression
// Use connection pooling
// Implement caching strategies
// Optimize database queries
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Docker Guide](https://docs.nestjs.com/deployment)
- [MongoDB Docker Guide](https://hub.docker.com/_/mongo)
- [Redis Docker Guide](https://hub.docker.com/_/redis)

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify environment variables
3. Check network connectivity
4. Ensure ports are not in use
5. Verify Docker and Docker Compose versions

The application is now fully containerized and ready for production deployment! 