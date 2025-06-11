#!/bin/bash

# TaskFlow AI Docker Deployment Script for Ubuntu 24.04
# This script will install and run TaskFlow AI in a Docker container
# making it accessible from any IP address

# Default variables
SERVER_IP=$(hostname -I | awk '{print $1}')
PORT=3001
REPO_URL="https://github.com/akdieselfreak/taskflow-ai.git"
APP_DIR="/opt/taskflow-ai"
CONTAINER_NAME="taskflow-ai"

# Help function
function show_help {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)"
    echo "  -p, --port PORT         Port to run the application (default: 3001)"
    echo "  -r, --repo REPO_URL     GitHub repository URL (default: akdieselfreak/taskflow-ai)"
    echo "  -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)"
    echo "  -c, --container NAME    Docker container name (default: taskflow-ai)"
    echo "  -h, --help              Show this help message"
    echo ""
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -i|--ip)
            SERVER_IP="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        -d|--dir)
            APP_DIR="$2"
            shift 2
            ;;
        -c|--container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            ;;
    esac
done

# Print banner
echo "=================================================="
echo "  TaskFlow AI Docker Deployment Script"
echo "  Server IP: $SERVER_IP"
echo "  Port: $PORT"
echo "=================================================="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root or with sudo"
  exit 1
fi

# Update system packages
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not already installed
echo "Checking for Docker installation..."
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  apt install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update
  apt install -y docker-ce docker-ce-cli containerd.io
  systemctl enable docker
  systemctl start docker
  echo "Docker installed successfully"
else
  echo "Docker is already installed"
fi

# Install Docker Compose if not already installed
echo "Checking for Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
  echo "Installing Docker Compose..."
  apt install -y docker-compose
  echo "Docker Compose installed successfully"
else
  echo "Docker Compose is already installed"
fi

# Create app directory
echo "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone the repository
echo "Cloning TaskFlow AI repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "Repository already exists, pulling latest changes..."
  git pull
else
  git clone $REPO_URL .
  echo "Repository cloned successfully"
fi

# Create data directory with proper permissions
echo "Setting up data directory..."
mkdir -p $APP_DIR/data
chmod 755 $APP_DIR/data

# Create Docker Compose file
echo "Creating Docker Compose file..."
cat > $APP_DIR/docker-compose.yml << EOL
version: '3'

services:
  taskflow:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${CONTAINER_NAME}
    restart: unless-stopped
    ports:
      - "${PORT}:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=data/taskflow.db
EOL

# Create Dockerfile if it doesn't exist or modify it
echo "Creating Dockerfile..."
cat > $APP_DIR/Dockerfile << EOL
FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the server listens on all interfaces
RUN sed -i 's/localhost/0.0.0.0/g' server.js

EXPOSE 3001

CMD ["node", "server.js"]
EOL

# Build and start the Docker container
echo "Building and starting Docker container..."
cd $APP_DIR
docker-compose up -d --build

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
  echo "TaskFlow AI Docker container is running"
else
  echo "Failed to start TaskFlow AI Docker container. Check logs with: docker logs $CONTAINER_NAME"
  exit 1
fi

# Configure firewall if ufw is active
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
  echo "Configuring firewall..."
  ufw allow $PORT/tcp
  echo "Firewall configured to allow traffic on port $PORT"
fi

# Print success message
echo "=================================================="
echo "  TaskFlow AI has been successfully deployed with Docker!"
echo "  You can access it at: http://$SERVER_IP:$PORT"
echo "=================================================="
echo ""
echo "Management commands:"
echo "  - View container logs: docker logs $CONTAINER_NAME"
echo "  - Restart container: docker restart $CONTAINER_NAME"
echo "  - Stop container: docker stop $CONTAINER_NAME"
echo "  - Start container: docker start $CONTAINER_NAME"
echo ""
echo "To update the application in the future, run:"
echo "  cd $APP_DIR && git pull && docker-compose up -d --build"
echo "=================================================="
