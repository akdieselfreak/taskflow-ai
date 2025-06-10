# Build Instructions for TaskFlow AI

## Quick Start

Choose one of the following methods to build and run TaskFlow AI:

### 1. Production Build (Recommended)
```bash
# Clone and build
git clone <repository-url>
cd taskflow-ai
docker-compose up -d

# Access at http://localhost:8080
```

### 2. Development Build (with live reload)
```bash
# Clone and build for development
git clone <repository-url>
cd taskflow-ai
docker-compose -f docker-compose.dev.yml up -d

# Access at http://localhost:8080
# Files are mounted for live editing
```

### 3. With Local AI (Ollama)
```bash
# Clone and build with Ollama service
git clone <repository-url>
cd taskflow-ai
docker-compose --profile with-ollama up -d

# TaskFlow AI: http://localhost:8080
# Ollama API: http://localhost:11434
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

## What's Fixed

✅ **Network Mode**: Removed problematic `host` network mode  
✅ **Bridge Networking**: Now uses secure bridge networks  
✅ **Port Mapping**: Consistent 8080:8080 port mapping  
✅ **Service Isolation**: Containers are properly isolated  
✅ **Ollama Integration**: Optional AI service with profiles  

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Check container status
docker ps

# Access container shell (for debugging)
docker exec -it taskflow-ai sh
```

## Network Architecture

- **Production**: `taskflow-network` (bridge)
- **Development**: Same network + volume mounts
- **Security**: Containers isolated from host
- **Scalability**: Easy to add more services

For detailed documentation, see [DOCKER.md](./DOCKER.md)
