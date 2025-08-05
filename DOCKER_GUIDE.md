# Docker Guide for AQI API

This guide provides instructions to run the AQI API (NestJS) using Docker and Docker Compose.

---

## Overview

**Services:**

* `aqi-api`: Main API (NestJS)
* `mongodb`: Database
* `redis`: Cache & queue
* `mongo-express`: Mongo UI (optional)
* `redis-commander`: Redis UI (optional)
* `bull-board`: Queue dashboard (optional)

---

## Prerequisites

* Docker v20.10+
* Docker Compose v2.0+
* IQAir API key ([https://www.iqair.com/air-pollution-data-api](https://www.iqair.com/air-pollution-data-api))

---

## Setup

### 1. Configure Environment

```bash
cp env.example .env
```

Edit `.env` with:

```env
IQAIR_API_KEY=your_api_key
ADMIN_API_KEY=admin_api_key
NODE_ENV=production
PORT=3000
```

---

## Running the App

### Production

```bash
docker-compose up -d
docker-compose logs -f aqi-api
```

### Development

```bash
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f aqi-api-dev
```

---

## Common Commands

```bash
# Start/Stop
docker-compose up -d
docker-compose down

# Restart
docker-compose restart

# Logs
docker-compose logs -f aqi-api

# Rebuild
docker-compose up -d --build
```

For dev environment, add `-f docker-compose.dev.yml`.

---

## Access

* API: `http://localhost:3000`
* Health Check: `/api/analytics/health`
* Mongo Express: `http://localhost:8081`
* Redis Commander: `http://localhost:8082`
* Bull Board: `http://localhost:8083`

---

## Database Access

* MongoDB: `localhost:27017`
* Redis: `localhost:6379` (password: `redis123`)

---

## Monitoring & Debugging

```bash
docker stats             # Resource usage
docker-compose ps        # Status
docker inspect <name>    # Health check
```

### Inside Containers

```bash
docker exec -it aqi-api sh
docker exec -it aqi-mongodb mongosh
docker exec -it aqi-redis redis-cli
```

---

## Common Issues

### Port Conflicts

```bash
netstat -tulpn | grep :3000
sudo systemctl stop mongod redis
```

### Permissions

```bash
sudo chown -R $USER:$USER ./logs
sudo chmod -R 755 ./logs
```

---

## Config Overview

**Env Variables**

| Variable        | Description          | Default                                  |
| --------------- | -------------------- | ---------------------------------------- |
| `IQAIR_API_KEY` | IQAir API key        | (required)                               |
| `ADMIN_API_KEY` | Admin key            | `admin-api-key`                          |
| `NODE_ENV`      | Environment          | `production`                             |
| `PORT`          | Port                 | `3000`                                   |
| `MONGODB_URI`   | Mongo connection URI | `mongodb://mongodb:27017/aqi_monitoring` |
| `REDIS_HOST`    | Redis host           | `redis`                                  |
| `CACHE_TTL`     | Cache TTL (sec)      | `3600`                                   |

**Volumes**

| Service | Mount Path     | Purpose           |
| ------- | -------------- | ----------------- |
| aqi-api | `./logs`       | Logs              |
| mongodb | `mongodb_data` | DB persistence    |
| redis   | `redis_data`   | Cache persistence |

---

## Production Notes

### SSL

* Place certs in `./ssl`
* Configure reverse proxy (e.g. Nginx)

### Example Nginx Config

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /ssl/cert.pem;
    ssl_certificate_key /ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

---

## Scaling

### Horizontal

```bash
docker-compose up -d --scale aqi-api=3
```

Use Nginx or Traefik for load balancing.

### Vertical

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

---

## Maintenance

```bash
docker image prune       # Unused images
docker volume prune      # Unused volumes
docker system prune -a   # Full cleanup
```

### Backup Script (Example)

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups/$DATE

docker exec aqi-mongodb mongodump --out /data/backup
docker cp aqi-mongodb:/data/backup ./backups/$DATE/mongodb

docker exec aqi-redis redis-cli BGSAVE
docker cp aqi-redis:/data/dump.rdb ./backups/$DATE/redis/

tar -czf ./backups/$DATE.tar.gz ./backups/$DATE
rm -rf ./backups/$DATE
```

---

## CI/CD

### GitHub Actions Example

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        run: |
          docker-compose pull
          docker-compose up -d
```

---

## Resources

* [Docker Docs](https://docs.docker.com/)
* [NestJS Deployment](https://docs.nestjs.com/deployment)

Let me know if you'd like it as a downloadable file or formatted for Notion.
