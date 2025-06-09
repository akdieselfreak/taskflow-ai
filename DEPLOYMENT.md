# TaskFlow AI - Simple Deployment Guide

## 🚀 One-Command Deployment

### Option 1: Docker Compose (Recommended)
```bash
# Download and start TaskFlow AI
curl -O https://raw.githubusercontent.com/akdieselfreak/taskflow-ai/main/docker-compose.yml
docker-compose up -d

# Access at http://localhost:8080
```

### Option 2: With Local AI (Ollama)
```bash
# Download docker-compose.yml first, then:
docker-compose --profile with-ollama up -d

# TaskFlow AI: http://localhost:8080
# Ollama: http://localhost:11434
```

### Option 3: Direct Docker Run
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

### Port Already in Use
```bash
# Check what's using port 8080
sudo lsof -i :8080

# Use different port
docker run -d -p 8081:80 --name taskflow-ai akdieselfreak/taskflow-ai:latest
```

### Container Won't Start
```bash
# Check logs
docker logs taskflow-ai

# Check if Docker is running
sudo systemctl status docker
```

### Can't Access Application
1. Check if container is running: `docker ps`
2. Check port mapping: `docker port taskflow-ai`
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
