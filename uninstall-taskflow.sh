#!/bin/bash

# TaskFlow AI Uninstallation Script for Ubuntu 24.04
# This script will remove TaskFlow AI and all its components from your Ubuntu server

# Default variables
APP_DIR="/opt/taskflow-ai"
PORT=3001

# Help function
function show_help {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIRECTORY     Installation directory to remove (default: /opt/taskflow-ai)"
    echo "  -p, --port PORT         Port used by the application (default: 3001)"
    echo "  -k, --keep-data         Keep the database and user data"
    echo "  -h, --help              Show this help message"
    echo ""
    exit 0
}

# Default flags
KEEP_DATA=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -d|--dir)
            APP_DIR="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -k|--keep-data)
            KEEP_DATA=true
            shift
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
echo "  TaskFlow AI Uninstallation Script for Ubuntu 24.04"
echo "  Application Directory: $APP_DIR"
echo "  Port: $PORT"
echo "  Keep Data: $KEEP_DATA"
echo "=================================================="

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root or with sudo"
  exit 1
fi

# Confirm uninstallation
echo "WARNING: This will remove TaskFlow AI and all its components from your system."
echo "This action cannot be undone."
read -p "Are you sure you want to proceed? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 1
fi

# Stop and disable the systemd service
echo "Stopping and disabling TaskFlow AI service..."
systemctl stop taskflow.service
systemctl disable taskflow.service
rm -f /etc/systemd/system/taskflow.service
systemctl daemon-reload
systemctl reset-failed

# Check if Nginx is installed and remove TaskFlow configuration
if command -v nginx &> /dev/null; then
    echo "Checking for Nginx configuration..."
    if [ -f /etc/nginx/sites-enabled/taskflow ]; then
        echo "Removing Nginx configuration..."
        rm -f /etc/nginx/sites-enabled/taskflow
        rm -f /etc/nginx/sites-available/taskflow
        systemctl restart nginx
    fi
    
    # Check for SSL certificates
    if [ -d /etc/nginx/ssl ]; then
        echo "Checking for TaskFlow SSL certificates..."
        if [ -f /etc/nginx/ssl/taskflow.key ] || [ -f /etc/nginx/ssl/taskflow.crt ]; then
            echo "Removing TaskFlow SSL certificates..."
            rm -f /etc/nginx/ssl/taskflow.key
            rm -f /etc/nginx/ssl/taskflow.crt
        fi
    fi
fi

# Remove firewall rules if ufw is active
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    echo "Removing firewall rules..."
    ufw delete allow $PORT/tcp
    # If we had Nginx configured, also remove those rules
    if command -v nginx &> /dev/null; then
        ufw delete allow 80/tcp 2>/dev/null
        ufw delete allow 443/tcp 2>/dev/null
    fi
fi

# Backup data if requested
if [ "$KEEP_DATA" = true ] && [ -d "$APP_DIR/data" ]; then
    BACKUP_DIR="/opt/taskflow-backup-$(date +%Y%m%d%H%M%S)"
    echo "Backing up data to $BACKUP_DIR..."
    mkdir -p $BACKUP_DIR
    cp -r $APP_DIR/data $BACKUP_DIR/
    echo "Data backed up successfully."
fi

# Remove application directory
echo "Removing application directory..."
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    echo "Application directory removed."
else
    echo "Application directory not found."
fi

# Check if Node.js was installed by the script and ask if it should be removed
echo "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Node.js $NODE_VERSION is installed."
    read -p "Do you want to remove Node.js? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing Node.js..."
        apt-get remove -y nodejs
        apt-get autoremove -y
        rm -rf /etc/apt/sources.list.d/nodesource.list
        apt-get update
        echo "Node.js removed."
    else
        echo "Keeping Node.js installation."
    fi
fi

# Print success message
echo "=================================================="
echo "  TaskFlow AI has been successfully uninstalled!"
if [ "$KEEP_DATA" = true ]; then
    echo "  Your data has been backed up to: $BACKUP_DIR"
fi
echo "=================================================="
echo ""
echo "The following components have been removed:"
echo "  - TaskFlow AI application files"
echo "  - TaskFlow AI systemd service"
echo "  - Firewall rules for TaskFlow AI"
if command -v nginx &> /dev/null; then
    echo "  - Nginx configuration for TaskFlow AI"
    echo "  - SSL certificates for TaskFlow AI"
fi
echo ""
echo "To completely remove all dependencies, you may want to run:"
echo "  sudo apt-get autoremove"
echo "=================================================="
