# Docker Deployment Guide for TaskFlow AI

This guide explains how to properly deploy TaskFlow AI using Docker with correct environment configuration.

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.docker .env
   ```

2. **Edit the .env file with your configuration:**
   ```bash
   nano .env
   ```

3. **Deploy with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

## Environment Configuration

### Required Configuration

Edit your `.env` file with the following settings:

```bash
# Security (REQUIRED - Change this!)
JWT_SECRET=your-super-secure-secret-key-here-change-this-in-production

# External access configuration
# Set these to your actual hostname/IP and port when deploying
EXTERNAL_HOST=your-server-ip-or-domain
EXTERNAL_PORT=8080

# CORS (comma-separated origins)
# Add all domains/IPs that will access your app
CORS_ORIGIN=http://your-server-ip:8080,https://your-domain.com
```

### Example Configurations

#### Local Development
```bash
EXTERNAL_HOST=localhost
EXTERNAL_PORT=8080
CORS_ORIGIN=http://localhost:8080
```

#### Production Server (IP-based)
```bash
EXTERNAL_HOST=192.168.1.100
EXTERNAL_PORT=8080
CORS_ORIGIN=http://192.168.1.100:8080,https://192.168.1.100:8080
```

#### Production Server (Domain-based)
```bash
EXTERNAL_HOST=taskflow.yourdomain.com
EXTERNAL_PORT=443
CORS_ORIGIN=https://taskflow.yourdomain.com
```

## Deployment Steps

### 1. Prepare Environment

```bash
# Clone the repository
git clone <your-repo>
cd taskflow-ai

# Copy and configure environment
cp .env.docker .env
nano .env  # Edit with your settings
```

### 2. Deploy Application

```bash
# Build and start the application
docker-compose up -d

# Check logs
docker-compose logs -f taskflow-ai

# Check health
curl http://your-server-ip:8080/health
```

### 3. Deploy with Ollama (Optional)

```bash
# Deploy with local AI support
docker-compose --profile with-ollama up -d

# Pull a model (example)
docker exec taskflow-ollama ollama pull llama2
```

## Security Considerations

### 1. Change Default Secrets
```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
```

### 2. Configure CORS Properly
Only allow origins you trust:
```bash
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

### 3. Use HTTPS in Production
Configure a reverse proxy (nginx/traefik) for HTTPS:
```bash
CORS_ORIGIN=https://taskflow.yourdomain.com
```

## Troubleshooting

### CORS Errors
If you see CORS errors in the browser console:

1. Check your `CORS_ORIGIN` setting includes the exact URL you're accessing
2. Ensure the protocol (http/https) matches
3. Include the port number if not using standard ports (80/443)

Example fix:
```bash
# If accessing via http://192.168.1.100:8080
CORS_ORIGIN=http://192.168.1.100:8080,https://192.168.1.100:8080
```

### Module Loading Errors
If you see "Module source URI is not allowed":

1. This is usually a CORS/CSP issue
2. Ensure your `EXTERNAL_HOST` and `CORS_ORIGIN` are correctly set
3. Check that you're accessing the app via the configured domain/IP

### Connection Refused
If the app won't load:

1. Check if the container is running: `docker-compose ps`
2. Check logs: `docker-compose logs taskflow-ai`
3. Verify port mapping: `docker-compose port taskflow-ai 3001`
4. Test health endpoint: `curl http://localhost:8080/health`

## Advanced Configuration

### Custom Port Mapping
```yaml
# In docker-compose.yml
ports:
  - "9000:3001"  # Access via port 9000

# Update .env accordingly
EXTERNAL_PORT=9000
CORS_ORIGIN=http://your-server-ip:9000
```

### Behind Reverse Proxy
```bash
# For apps behind nginx/traefik
EXTERNAL_HOST=taskflow.yourdomain.com
EXTERNAL_PORT=443
CORS_ORIGIN=https://taskflow.yourdomain.com
```

### Multiple Domains
```bash
# Support multiple access points
CORS_ORIGIN=https://taskflow.yourdomain.com,https://tasks.company.com,http://192.168.1.100:8080
```

## Monitoring

### Health Checks
```bash
# Application health
curl http://your-server-ip:8080/health

# Container health
docker-compose ps
```

### Logs
```bash
# View logs
docker-compose logs -f taskflow-ai

# View specific timeframe
docker-compose logs --since 1h taskflow-ai
```

### Database Backup
```bash
# Backup database
docker-compose exec taskflow-ai cp /app/data/taskflow.db /app/data/backup-$(date +%Y%m%d).db

# Copy to host
docker cp taskflow-ai:/app/data/backup-$(date +%Y%m%d).db ./
```

## Updates

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Update Dependencies
```bash
# Rebuild with latest dependencies
docker-compose build --no-cache --pull
docker-compose up -d
```

## Support

If you encounter issues:

1. Check this deployment guide
2. Review the logs: `docker-compose logs taskflow-ai`
3. Verify your `.env` configuration
4. Test the health endpoint
5. Check CORS settings match your access URL

For additional help, please refer to the main README.md or open an issue in the repository.
