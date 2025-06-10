# Docker Deployment Guide for TaskFlow AI

## Overview

TaskFlow AI is containerized using Docker with nginx as the web server. This provides a production-ready deployment that's easy to scale and manage.

## Prerequisites

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- Git (for cloning the repository)

## Quick Start

### Option 1: Production Build with Docker Compose (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd taskflow-ai

# Build and start the application
docker-compose up -d

# Access the application at http://localhost:8080
```

### Option 2: Development Build with Hot Reload
```bash
# Clone the repository
git clone <repository-url>
cd taskflow-ai

# Start development environment with file watching
docker-compose -f docker-compose.dev.yml up -d

# Access the application at http://localhost:8080
# Files are mounted for live editing
```

### Option 3: Production Build with Ollama AI Service
```bash
# Clone the repository
git clone <repository-url>
cd taskflow-ai

# Start with Ollama service for local AI
docker-compose --profile with-ollama up -d

# Access the application at http://localhost:8080
# Ollama API available at http://localhost:11434
```

### Option 4: Direct Docker Build
```bash
# Clone the repository
git clone <repository-url>
cd taskflow-ai

# Build the image
docker build -t taskflow-ai .

# Run the container
docker run -d -p 8080:8080 --name taskflow-ai taskflow-ai

# Access the application at http://localhost:8080
```

## Container Architecture

### Base Image
- **nginx:alpine** - Lightweight, secure, production-ready
- **Size**: ~15MB base + application files
- **Security**: Non-root user, minimal attack surface

### Features
- ✅ Production-ready nginx configuration
- ✅ Gzip compression for better performance
- ✅ Security headers (XSS, CSRF protection)
- ✅ Health checks for monitoring
- ✅ Non-root user for security
- ✅ Proper caching for static assets
- ✅ SPA routing support

## Configuration Options

### Environment Variables
```bash
# Set environment (optional)
docker run -e NODE_ENV=production -p 8080:8080 taskflow-ai
```

### Port Mapping
```bash
# Use different port
docker run -p 3000:8080 taskflow-ai

# Access at http://localhost:3000
```

### Volume Mounting (for development)
```bash
# Mount source code for live editing
docker run -p 8080:8080 -v $(pwd):/usr/share/nginx/html taskflow-ai
```

## Docker Compose Services

### TaskFlow AI Service
- **Port**: 8080:8080
- **Health Check**: HTTP endpoint at `/health`
- **Restart Policy**: unless-stopped
- **Network**: taskflow-network (bridge mode)

### Ollama AI Service (Optional)
- **Port**: 11434:11434
- **Volume**: ollama_data for model storage
- **Health Check**: API endpoint at `/api/tags`
- **Profile**: with-ollama (use `--profile with-ollama` to enable)

## Network Configuration

The Docker setup now uses proper bridge networking instead of host mode for better security and isolation:

- **Production**: Uses `taskflow-network` bridge network
- **Development**: Same network with volume mounts for live editing
- **Security**: Containers are isolated from host network
- **Scalability**: Easy to add more services to the same network


## Production Deployment

### With Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml taskflow

# Scale services
docker service scale taskflow_taskflow-ai=3
```

### With Kubernetes
```yaml
# Example deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taskflow-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: taskflow-ai
  template:
    metadata:
      labels:
        app: taskflow-ai
    spec:
      containers:
      - name: taskflow-ai
        image: taskflow-ai:latest
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Behind Reverse Proxy
```nginx
# nginx reverse proxy config
server {
    listen 80;
    server_name taskflow.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring & Logging

### Health Checks
```bash
# Check container health
docker ps

# Manual health check
curl http://localhost:8080/health
```

### Logs
```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f taskflow-ai
```

### Metrics
```bash
# Container stats
docker stats

# Resource usage
docker system df
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 8080
lsof -i :8080

# Use different port
docker run -p 8081:8080 taskflow-ai
```

#### Permission Denied
```bash
# Check if Docker daemon is running
sudo systemctl status docker

# Add user to docker group
sudo usermod -aG docker $USER
```

#### Container Won't Start
```bash
# Check logs
docker logs <container-id>

# Debug with shell access
docker run -it --entrypoint /bin/sh taskflow-ai
```


## Security Considerations

### Container Security
- ✅ Non-root user (taskflow:1001)
- ✅ Minimal base image (Alpine Linux)
- ✅ No unnecessary packages
- ✅ Security headers in nginx
- ✅ Health checks for monitoring

### Network Security
```bash
# Use custom network
docker network create taskflow-secure
docker run --network taskflow-secure taskflow-ai
```

### Secrets Management
```bash
# Use Docker secrets for API keys
echo "your-api-key" | docker secret create openai-key -
```

## Performance Optimization

### Resource Limits
```yaml
# docker-compose.yml
services:
  taskflow-ai:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
        reservations:
          cpus: '0.25'
          memory: 64M
```

### Caching
- Static assets cached for 1 year
- HTML files not cached (for updates)
- Gzip compression enabled

### Multi-stage Build (Future)
```dockerfile
# Example multi-stage build
FROM node:alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM nginx:alpine
COPY --from=builder /app /usr/share/nginx/html
```

## Backup & Recovery

### Data Backup
```bash
# Backup application data (if using volumes)
docker run --rm -v taskflow_data:/data -v $(pwd):/backup alpine tar czf /backup/taskflow-backup.tar.gz /data
```

### Container Images
```bash
# Save image
docker save taskflow-ai > taskflow-ai.tar

# Load image
docker load < taskflow-ai.tar
```

This Docker setup provides a robust, scalable, and secure deployment option for TaskFlow AI.
