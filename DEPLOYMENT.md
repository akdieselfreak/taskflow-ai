# TaskFlow AI - Simple Deployment Guide

## 🚀 One-Command Deployment

### Option 1: Docker Compose (Recommended)
```bash
# Clone repository and build
git clone <repository-url>
cd taskflow-ai
docker-compose up -d

# Access at http://localhost:8080
```

### Option 2: Direct Docker Run
```bash
# Single container deployment
docker run -d -p 8080:80 --name taskflow-ai akdieselfreak/taskflow-ai:latest

# Access at http://localhost:8080
```

## 📋 Requirements

- Docker installed
- Docker Compose installed (for multi-service setup)
- Port 8080 available (or change to another port)

## 🔧 Configuration

### Change Port
```bash
# Use port 3000 instead of 8080
docker run -d -p 3000:80 --name taskflow-ai akdieselfreak/taskflow-ai:latest
```

### Persistent Data
TaskFlow AI stores data in browser localStorage. For backup:
1. Use the export feature in the app
2. Save exported files outside the container

### Environment Variables
```bash
# Set production environment
docker run -d -p 8080:80 -e NODE_ENV=production --name taskflow-ai akdieselfreak/taskflow-ai:latest
```

## 🛑 Stop/Remove

```bash
# Stop containers
docker-compose down

# Or stop single container
docker stop taskflow-ai
docker rm taskflow-ai
```

## 🔄 Updates

```bash
# Pull latest image and restart
docker-compose pull
docker-compose up -d

# Or for single container
docker pull akdieselfreak/taskflow-ai:latest
docker stop taskflow-ai
docker rm taskflow-ai
docker run -d -p 8080:80 --name taskflow-ai akdieselfreak/taskflow-ai:latest
```

## 🌐 Production Deployment

### Behind Reverse Proxy (nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### With SSL (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

## 🆘 Troubleshooting

### Nginx Permission Errors
If you see `Permission denied` errors for `/run/nginx.pid`:
```bash
# Stop and remove existing containers
docker-compose down --volumes --remove-orphans

# Force rebuild without cache
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

### Container Configuration Errors
If you see `ContainerConfig` or similar errors:
```bash
# Clean up corrupted containers
docker-compose down --volumes --remove-orphans
docker system prune -f

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

### Port Already in Use
```bash
# Check what's using port 8080
sudo lsof -i :8080

# Use different port by editing docker-compose.yml
# Change "8080:80" to "8081:80"
```

### Container Won't Start
```bash
# Check logs
docker-compose logs taskflow-ai

# Check if Docker is running
sudo systemctl status docker
```

### Can't Connect to Local Ollama
If TaskFlow AI can't connect to Ollama running on the same machine:

**Problem**: Docker containers can't access `localhost` services on the host

**Solution 1 - Host Network Mode (Recommended)**:
The docker-compose.yml is configured to use `network_mode: host` which allows the container to access localhost services.

**Solution 2 - Use Host IP**:
Instead of `http://localhost:11434`, use your machine's IP:
- Find your IP: `ip addr show` or `ifconfig`
- Use: `http://YOUR_IP:11434/api/chat`

**Solution 3 - Docker Desktop (Mac/Windows)**:
Use the special hostname: `http://host.docker.internal:11434/api/chat`

### Can't Access Application
1. Check if container is running: `docker-compose ps`
2. Check port mapping (if not using host mode): `docker-compose port taskflow-ai 80`
3. Check firewall settings
4. Try accessing: `curl http://localhost:8080`

## 📊 Monitoring

### Health Check
```bash
# Check if app is healthy
curl http://localhost:8080/health
```

### View Logs
```bash
# Real-time logs
docker logs -f taskflow-ai

# Or with docker-compose
docker-compose logs -f
```

### Resource Usage
```bash
# Check container stats
docker stats taskflow-ai
```

That's it! TaskFlow AI should now be running and accessible at http://localhost:8080
