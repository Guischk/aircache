# Production Deployment Guide

## Overview

This guide covers deploying Airboost in production environments with considerations for performance, security, and reliability.

## System Requirements

### Minimum Requirements
- CPU: 1 core (2+ cores recommended)
- RAM: 512MB (1GB+ recommended)
- Storage: 10GB (depends on dataset size)
- Network: Reliable internet connection for Airtable API access

### Recommended Requirements
- CPU: 2+ cores for concurrent operations
- RAM: 2GB+ for large datasets
- Storage: SSD with 50GB+ available space
- Network: Low-latency connection with high availability

## Pre-deployment Checklist

### Environment Preparation
- [ ] Server with supported OS (Linux, macOS, Windows)
- [ ] Bun runtime installed
- [ ] Proper file permissions configured
- [ ] Network access to Airtable API
- [ ] SSL certificate for HTTPS (recommended)
- [ ] Monitoring tools configured

### Security Configuration
- [ ] Strong `BEARER_TOKEN` generated
- [ ] Airtable token with minimal required permissions
- [ ] File system permissions restricted
- [ ] Firewall rules configured
- [ ] Regular backup strategy planned

## Deployment Options

### 1. Direct Server Deployment

#### Installation
```bash
# Create application user
sudo useradd -r -s /bin/false airboost
sudo mkdir -p /opt/airboost
sudo chown airboost:airboost /opt/airboost

# Install application
cd /opt/airboost
git clone <repository-url> .
bun install --production
```

#### Configuration
```bash
# Create production environment file
sudo -u airboost tee /opt/airboost/.env << EOF
AIRTABLE_PERSONAL_TOKEN=pat_your_production_token
AIRTABLE_BASE_ID=app_your_base_id
BEARER_TOKEN=$(openssl rand -hex 32)
PORT=3000
REFRESH_INTERVAL=86400
STORAGE_PATH=/var/lib/airboost/attachments
SQLITE_PATH=/var/lib/airboost/db
ENABLE_ATTACHMENT_DOWNLOAD=true
EOF

# Create data directories
sudo mkdir -p /var/lib/airboost/{db,attachments}
sudo chown -R airboost:airboost /var/lib/airboost
sudo chmod 750 /var/lib/airboost
```

#### Systemd Service
```bash
# Create systemd service file
sudo tee /etc/systemd/system/airboost.service << EOF
[Unit]
Description=Airboost Airtable Cache Service
After=network.target

[Service]
Type=simple
User=airboost
Group=airboost
WorkingDirectory=/opt/airboost
ExecStart=/usr/local/bin/bun index.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/airboost/.env

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/airboost
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable airboost
sudo systemctl start airboost
```

### 2. Docker Deployment

#### Dockerfile
```dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install --production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup --system --gid 1001 airboost && \
    adduser --system --uid 1001 --group airboost

# Create data directories
RUN mkdir -p /app/data/{db,attachments} && \
    chown -R airboost:airboost /app/data

USER airboost

EXPOSE 3000

CMD ["bun", "index.ts"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  airboost:
    build: .
    ports:
      - "3000:3000"
    environment:
      - AIRTABLE_PERSONAL_TOKEN=${AIRTABLE_PERSONAL_TOKEN}
      - AIRTABLE_BASE_ID=${AIRTABLE_BASE_ID}
      - BEARER_TOKEN=${BEARER_TOKEN}
      - REFRESH_INTERVAL=86400
      - STORAGE_PATH=/app/data/attachments
      - SQLITE_PATH=/app/data/db
    volumes:
      - airboost_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  airboost_data:
```

### 3. Cloud Platform Deployment

See [Railway Deployment Guide](railway.md) for Railway-specific instructions.

#### Heroku
```bash
# Install Heroku CLI and login
heroku login

# Create application
heroku create your-airboost-app

# Configure environment variables
heroku config:set AIRTABLE_PERSONAL_TOKEN=your_token
heroku config:set AIRTABLE_BASE_ID=your_base_id
heroku config:set BEARER_TOKEN=$(openssl rand -hex 32)

# Deploy
git push heroku main
```

#### DigitalOcean App Platform
```yaml
# .do/app.yaml
name: airboost
services:
- name: web
  source_dir: /
  github:
    repo: your-username/airboost
    branch: main
  run_command: bun index.ts
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: AIRTABLE_PERSONAL_TOKEN
    value: your_token
    type: SECRET
  - key: AIRTABLE_BASE_ID
    value: your_base_id
  - key: BEARER_TOKEN
    value: your_bearer_token
    type: SECRET
```

## Load Balancing and High Availability

### Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/airboost
upstream airboost {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001 backup;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://airboost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Health check exclusion
        if ($request_uri = /health) {
            access_log off;
        }
    }

    # Rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://airboost;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limit configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

### Multiple Instances
```bash
# Start multiple instances on different ports
PORT=3000 bun index.ts &
PORT=3001 bun index.ts &
PORT=3002 bun index.ts &
```

## Monitoring and Logging

### Health Checks
```bash
# Simple health check script
#!/bin/bash
curl -f http://localhost:3000/health || exit 1
```

### Logging Configuration
```bash
# Systemd journal logs
sudo journalctl -u airboost -f

# Application logs
tail -f /var/log/airboost/app.log
```

### Monitoring Script
```bash
#!/bin/bash
# /opt/airboost/scripts/monitor.sh

# Check service status
if ! systemctl is-active --quiet airboost; then
    echo "CRITICAL: Airboost service is not running"
    systemctl restart airboost
fi

# Check disk space
DISK_USAGE=$(df /var/lib/airboost | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "WARNING: Disk usage is at ${DISK_USAGE}%"
fi

# Check database file sizes
DB_SIZE=$(du -sh /var/lib/airboost/db/*.db 2>/dev/null | sort -hr | head -1)
echo "Largest database: $DB_SIZE"

# Check API response
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/health)
if [ "$RESPONSE" != "200" ]; then
    echo "WARNING: Health check failed with status $RESPONSE"
fi
```

## Backup Strategy

### Database Backup
```bash
#!/bin/bash
# /opt/airboost/scripts/backup.sh

BACKUP_DIR="/var/backups/airboost"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup active database
cp /var/lib/airboost/db/cache_v*.db $BACKUP_DIR/airboost_${DATE}.db

# Compress old backups
find $BACKUP_DIR -name "*.db" -mtime +7 -exec gzip {} \;

# Remove old compressed backups
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: airboost_${DATE}.db"
```

### Automated Backup (Cron)
```bash
# Add to crontab
0 2 * * * /opt/airboost/scripts/backup.sh
```

## Performance Optimization

### Database Optimization
```sql
-- Run occasionally to optimize database
VACUUM;
ANALYZE;
```

### System Tuning
```bash
# Increase file descriptor limits
echo "airboost soft nofile 65536" >> /etc/security/limits.conf
echo "airboost hard nofile 65536" >> /etc/security/limits.conf

# Optimize SQLite settings
echo "PRAGMA journal_mode=WAL;" | sqlite3 /var/lib/airboost/db/cache_v1.db
```

### Monitoring Performance
```bash
# Monitor resource usage
htop
iotop
ss -tlnp | grep :3000
```

## Security Hardening

### File Permissions
```bash
# Restrict access to configuration
chmod 600 /opt/airboost/.env
chown airboost:airboost /opt/airboost/.env

# Secure data directory
chmod 750 /var/lib/airboost
chmod 640 /var/lib/airboost/db/*.db
```

### Network Security
```bash
# Configure firewall (UFW example)
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Block direct access to application port
ufw deny 3000/tcp
```

### Regular Security Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Bun runtime
curl -fsSL https://bun.sh/install | bash

# Update dependencies
bun update
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   sudo journalctl -u airboost -n 50
   ```

2. **High Memory Usage**
   ```bash
   top -p $(pgrep -f airboost)
   ```

3. **Database Corruption**
   ```bash
   sqlite3 /var/lib/airboost/db/cache_v1.db ".schema"
   ```

4. **Network Issues**
   ```bash
   curl -v https://api.airtable.com/v0/meta/bases
   ```

### Emergency Procedures

#### Service Recovery
```bash
# Stop service
sudo systemctl stop airboost

# Clear corrupted databases
sudo rm /var/lib/airboost/db/*.db

# Restart service (will rebuild cache)
sudo systemctl start airboost
```

#### Rollback Deployment
```bash
# Git rollback
git reset --hard HEAD~1

# Restart service
sudo systemctl restart airboost
```

## Support and Maintenance

### Regular Maintenance Tasks
- Weekly: Review logs and performance metrics
- Monthly: Update dependencies and security patches
- Quarterly: Review and test backup/recovery procedures
- Annually: Security audit and performance review

### Monitoring Checklist
- [ ] Service uptime > 99.9%
- [ ] Response time < 100ms for cached queries
- [ ] Disk usage < 80%
- [ ] Memory usage stable
- [ ] Error rate < 0.1%
- [ ] Backup success rate 100%