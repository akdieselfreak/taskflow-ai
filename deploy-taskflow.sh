#!/bin/bash

# TaskFlow AI Deployment Script for Ubuntu 24.04
# This script will install and run TaskFlow AI on your Ubuntu server
# making it accessible from any IP address

# Default variables
SERVER_IP=$(hostname -I | awk '{print $1}')
PORT=3001
REPO_URL="https://github.com/akdieselfreak/taskflow-ai.git"
APP_DIR="/opt/taskflow-ai"
NODE_VERSION="20"

# Help function
function show_help {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -i, --ip IP_ADDRESS     Server IP address (default: auto-detected)"
    echo "  -p, --port PORT         Port to run the application (default: 3001)"
    echo "  -r, --repo REPO_URL     GitHub repository URL (default: akdieselfreak/taskflow-ai)"
    echo "  -d, --dir DIRECTORY     Installation directory (default: /opt/taskflow-ai)"
    echo "  -n, --node VERSION      Node.js version (default: 20)"
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
        -n|--node)
            NODE_VERSION="$2"
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
echo "  TaskFlow AI Deployment Script for Ubuntu 24.04"
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

# Install required dependencies
echo "Installing dependencies..."
apt install -y curl git build-essential sqlite3

# Install Node.js
echo "Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
  echo "Node.js $(node -v) installed successfully"
else
  echo "Node.js $(node -v) is already installed"
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

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Create data directory with proper permissions
echo "Setting up data directory..."
mkdir -p $APP_DIR/data
chmod 755 $APP_DIR/data

# Modify server.js to listen on all interfaces
echo "Configuring server to listen on all interfaces..."
sed -i "s/localhost/0.0.0.0/g" server.js

# Create environment file
echo "Creating .env file..."
cat > $APP_DIR/.env << EOL
PORT=$PORT
DB_PATH=data/taskflow.db
NODE_ENV=production
EOL

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/taskflow.service << EOL
[Unit]
Description=TaskFlow AI Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$(which node) server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd, enable and start service
echo "Enabling and starting TaskFlow AI service..."
systemctl daemon-reload
systemctl enable taskflow.service
systemctl start taskflow.service

# Check if service is running
if systemctl is-active --quiet taskflow.service; then
  echo "TaskFlow AI service is running"
else
  echo "Failed to start TaskFlow AI service. Check logs with: journalctl -u taskflow.service"
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
echo "  TaskFlow AI has been successfully deployed!"
echo "  You can access it at: http://$SERVER_IP:$PORT"
echo "=================================================="
echo ""
echo "Management commands:"
echo "  - Check service status: systemctl status taskflow.service"
echo "  - View logs: journalctl -u taskflow.service"
echo "  - Restart service: systemctl restart taskflow.service"
echo "  - Stop service: systemctl stop taskflow.service"
echo ""
echo "To update the application in the future, run:"
echo "  cd $APP_DIR && git pull && npm install && systemctl restart taskflow.service"
echo "=================================================="
